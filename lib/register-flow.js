const { needsEmailVerify } = require("./auth-verify");

const MIN_ANSWER_CHARS = 50;

function joinNextPath(user) {
  if (!user) return "/auth/login";
  if (user.status === "rejected") return "/join/status";
  if (!user.email_verified_at && needsEmailVerify(user)) {
    return `/join/verify-sent?email=${encodeURIComponent(user.email)}`;
  }
  if (!user.pledge_accepted_at) return "/join/pledge";
  if (!user.quiz_passed_at) return "/join/quiz";
  if (user.status === "pending" || user.role === "pending") return "/join/status";
  return null;
}

function getActiveStatement(db) {
  return db
    .prepare("SELECT * FROM sovereignty_statement WHERE is_active = 1 ORDER BY version DESC LIMIT 1")
    .get();
}

function getQuizQuestions(db) {
  return db
    .prepare("SELECT * FROM quiz_questions WHERE is_active = 1 ORDER BY order_num, id")
    .all();
}

function getSavedAnswers(db, userId) {
  const rows = db
    .prepare("SELECT question_id, answer_text FROM quiz_answers WHERE user_id = ?")
    .all(userId);
  const map = {};
  rows.forEach((r) => {
    map[r.question_id] = r.answer_text;
  });
  return map;
}

function saveQuizAnswers(db, userId, questions, formBody) {
  const now = new Date().toISOString();
  const errors = [];
  const ins = db.prepare(
    `INSERT INTO quiz_answers (user_id, question_id, answer_text, submitted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, question_id) DO UPDATE SET
       answer_text = excluded.answer_text,
       submitted_at = excluded.submitted_at`
  );
  for (const q of questions) {
    const text = (formBody[`q_${q.id}`] || "").trim();
    const minC = q.min_chars || MIN_ANSWER_CHARS;
    if (text.length < minC) {
      errors.push(`السؤال ${(q.order_num ?? 0) + 1}: الحد الأدنى ${minC} حرفاً.`);
      continue;
    }
    ins.run(userId, q.id, text, now);
  }
  if (errors.length) return { ok: false, errors };
  db.prepare("UPDATE users SET quiz_passed_at = ? WHERE id = ?").run(now, userId);
  return { ok: true };
}

function clearQuizForRetry(db, userId) {
  db.prepare("DELETE FROM quiz_answers WHERE user_id = ?").run(userId);
  db.prepare("UPDATE users SET quiz_passed_at = NULL WHERE id = ?").run(userId);
}

module.exports = {
  MIN_ANSWER_CHARS,
  joinNextPath,
  getActiveStatement,
  getQuizQuestions,
  getSavedAnswers,
  saveQuizAnswers,
  clearQuizForRetry,
};
