/** تفعيل العضو — موافقة إدارية أو 72 ساعة بعد إكمال اختبار الوعي */
const AUTO_ACTIVATE_HOURS = parseInt(process.env.MEMBER_AUTO_ACTIVATE_HOURS || "72", 10);

function activateMember(db, userId, approvedBy = null) {
  const id = parseInt(String(userId), 10);
  if (!Number.isFinite(id) || id < 1) return;
  const approver =
    approvedBy == null || approvedBy === ""
      ? null
      : parseInt(String(approvedBy), 10) || null;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE users SET status = 'active', role = 'member',
     approved_by = ?, approved_at = ?,
     pledge_accepted_at = COALESCE(pledge_accepted_at, ?),
     rejected_at = NULL, rejection_note = NULL
     WHERE id = ? AND status != 'rejected'`
  ).run(approver, now, now, id);
}

/** حسابات أكملت الاختبار ومرّ عليها 72+ ساعة — تفعيل تلقائي */
function runAutoActivationGrace(db) {
  const cutoff = new Date(Date.now() - AUTO_ACTIVATE_HOURS * 60 * 60 * 1000).toISOString();
  const pending = db
    .prepare(
      `SELECT id, email_verified_at FROM users
       WHERE status = 'pending' AND role = 'pending'
       AND email_verified_at IS NOT NULL
       AND pledge_accepted_at IS NOT NULL
       AND quiz_passed_at IS NOT NULL
       AND created_at <= ?`
    )
    .all(cutoff);
  if (!pending.length) return 0;
  let n = 0;
  for (const u of pending) {
    activateMember(db, u.id);
    n += 1;
  }
  return n;
}

function tryGraceActivateUser(db, user) {
  if (!user || user.status === "rejected") return user;
  if (user.status !== "pending" || user.role !== "pending") return user;
  if (!user.email_verified_at || !user.pledge_accepted_at || !user.quiz_passed_at) return user;
  const created = new Date(user.created_at || 0).getTime();
  if (!created || Date.now() - created < AUTO_ACTIVATE_HOURS * 60 * 60 * 1000) return user;
  activateMember(db, user.id);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
}

module.exports = {
  activateMember,
  runAutoActivationGrace,
  tryGraceActivateUser,
  AUTO_ACTIVATE_HOURS,
};
