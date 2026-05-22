const { activateMember } = require("./member-activation");
const { sendWelcomeEmail, sendRejectedEmail } = require("./mail");
const { clearQuizForRetry } = require("./register-flow");
const { parseUserId } = require("./ids");

function listPendingApplications(db) {
  return db
    .prepare(
      `SELECT * FROM users
       WHERE status = 'pending' AND role = 'pending'
       AND email_verified_at IS NOT NULL
       AND quiz_passed_at IS NULL
       ORDER BY created_at ASC`
    )
    .all();
}

function listQuizReviewQueue(db) {
  return db
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM quiz_answers qa WHERE qa.user_id = u.id) AS answer_count
       FROM users u
       WHERE u.quiz_passed_at IS NOT NULL
         AND (u.status = 'pending' OR u.role = 'pending')
       ORDER BY u.quiz_passed_at DESC`
    )
    .all();
}

function getQuizAnswersForUser(db, userId) {
  return db
    .prepare(
      `SELECT qa.*, qq.question, qq.order_num, qq.min_chars
       FROM quiz_answers qa
       JOIN quiz_questions qq ON qq.id = qa.question_id
       WHERE qa.user_id = ?
       ORDER BY qq.order_num, qq.id`
    )
    .all(userId);
}

async function approveUser(db, userId, approvedBy, note) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  activateMember(db, userId, approvedBy);
  const active = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  try {
    await sendWelcomeEmail(active, db);
  } catch (e) {
    console.error("[mail] approve", e);
  }
  db.prepare(
    `INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    approvedBy,
    "member_approved",
    JSON.stringify({ target_id: userId, note: note || null }),
    new Date().toISOString()
  );
  return { ok: true, user: active };
}

async function rejectUser(db, userId, actorId, note) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE users SET status = 'rejected', role = 'pending', rejected_at = ?, rejection_note = ?,
     approved_at = NULL, approved_by = NULL WHERE id = ?`
  ).run(now, note || null, userId);
  clearQuizForRetry(db, userId);
  try {
    await sendRejectedEmail(user, note, db);
  } catch (e) {
    console.error("[mail] reject", e);
  }
  db.prepare(
    `INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    actorId,
    "member_rejected",
    JSON.stringify({ target_id: userId, note: note || null }),
    now
  );
  return { ok: true };
}

function rejectQuizRetry(db, userId, actorId, note) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return { ok: false, error: "المستخدم غير موجود." };
  clearQuizForRetry(db, userId);
  if (note) {
    db.prepare("UPDATE users SET rejection_note = ? WHERE id = ?").run(note, userId);
  }
  db.prepare(
    `INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    actorId,
    "quiz_retry",
    JSON.stringify({ target_id: userId, note: note || null }),
    new Date().toISOString()
  );
  return { ok: true };
}

module.exports = {
  listPendingApplications,
  listQuizReviewQueue,
  getQuizAnswersForUser,
  approveUser,
  rejectUser,
  rejectQuizRetry,
};
