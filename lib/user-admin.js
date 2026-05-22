const ROLES = ["admin", "supervisor", "designer", "cadre", "member", "pending"];
const { parseUserId } = require("./ids");
const { finalizeUserPresence } = require("./presence-duration");
const { destroySessionsForUser } = require("./session-cleanup");

function countAdmins(db) {
  return db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get().c;
}

function getUser(db, id) {
  const uid = parseUserId(id);
  if (!uid) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(uid);
}

function updateMemberRole(db, targetId, newRole, actorId, actorRole = "admin") {
  const tid = parseUserId(targetId);
  const aid = parseUserId(actorId);
  if (!tid) return { ok: false, error: "معرّف العضو غير صالح." };
  if (!ROLES.includes(newRole)) {
    return { ok: false, error: "دور غير صالح." };
  }
  const target = getUser(db, tid);
  if (!target) return { ok: false, error: "المستخدم غير موجود." };
  if (actorRole === "supervisor" && (newRole === "admin" || target.role === "admin")) {
    return { ok: false, error: "المشرف لا يمكنه تعديل حسابات المدير أو تعيين دور مدير." };
  }
  if (aid && tid === aid && newRole !== "admin") {
    return { ok: false, error: "لا يمكنك إزالة صلاحية المدير من حسابك." };
  }
  if (target.role === "admin" && newRole !== "admin" && countAdmins(db) <= 1) {
    return { ok: false, error: "لا يمكن إزالة آخر مدير للنظام." };
  }
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(newRole, tid);
  db.prepare(
    `INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    aid,
    "user_role_change",
    JSON.stringify({ target_id: tid, from: target.role, to: newRole }),
    new Date().toISOString()
  );
  return { ok: true };
}

function deleteMemberAccount(db, targetId, actorId) {
  const tid = parseUserId(targetId);
  const aid = parseUserId(actorId);
  if (!tid) return { ok: false, error: "معرّف العضو غير صالح." };
  const target = getUser(db, tid);
  if (!target) return { ok: false, error: "المستخدم غير موجود." };
  if (aid && tid === aid) {
    return { ok: false, error: "لا يمكنك حذف حسابك وأنت مسجّل الدخول." };
  }
  if (target.role === "admin" && countAdmins(db) <= 1) {
    return { ok: false, error: "لا يمكن حذف آخر مدير للنظام." };
  }

  const id = tid;

  finalizeUserPresence(db, id);
  destroySessionsForUser(id);

  const stmts = [
    ["DELETE FROM presence_sessions WHERE user_id = ?", [id]],
    ["DELETE FROM auth_tokens WHERE user_id = ?", [id]],
    ["DELETE FROM push_subscriptions WHERE user_id = ?", [id]],
    ["DELETE FROM quiz_answers WHERE user_id = ?", [id]],
    ["DELETE FROM owner_messages WHERE member_id = ?", [id]],
    ["DELETE FROM journals WHERE user_id = ?", [id]],
    ["DELETE FROM community_posts WHERE user_id = ?", [id]],
    ["DELETE FROM cadre_profiles WHERE user_id = ?", [id]],
    ["DELETE FROM knowledge_articles WHERE author_id = ?", [id]],
    ["DELETE FROM consultations WHERE member_id = ? OR cadre_id = ?", [id, id]],
    ["DELETE FROM market_orders WHERE user_id = ?", [id]],
    ["DELETE FROM audit_log WHERE user_id = ?", [id]],
    ["UPDATE users SET approved_by = NULL WHERE approved_by = ?", [id]],
    ["UPDATE users SET admin_rated_by = NULL WHERE admin_rated_by = ?", [id]],
    ["UPDATE community_posts SET reviewed_by = NULL WHERE reviewed_by = ?", [id]],
    ["UPDATE theme_settings SET updated_by = NULL WHERE updated_by = ?", [id]],
    ["UPDATE newsletters SET created_by = NULL WHERE created_by = ?", [id]],
    ["DELETE FROM users WHERE id = ?", [id]],
  ];

  for (const [sql, params] of stmts) {
    db.prepare(sql).run(...params);
  }

  db.prepare(
    `INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    aid,
    "user_deleted",
    JSON.stringify({ target_id: id, email: target.email, username: target.username }),
    new Date().toISOString()
  );
  return { ok: true };
}

module.exports = {
  ROLES,
  countAdmins,
  updateMemberRole,
  deleteMemberAccount,
};
