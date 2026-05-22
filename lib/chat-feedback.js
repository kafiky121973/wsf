function migrateChatFeedback(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      slug TEXT,
      answer_mode TEXT,
      helpful INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_feedback_created ON chat_feedback(created_at);
  `);
}

function recordFeedback(db, userId, { question, helpful, slug, answerMode, note }) {
  const uid = parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) return { ok: false };
  const q = String(question || "").trim().slice(0, 2000);
  if (!q) return { ok: false, error: "السؤال مطلوب." };
  const h = helpful === 1 || helpful === true || helpful === "1" ? 1 : 0;
  db.prepare(
    `INSERT INTO chat_feedback (user_id, question, slug, answer_mode, helpful, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uid,
    q,
    slug ? String(slug).slice(0, 80) : null,
    answerMode ? String(answerMode).slice(0, 32) : null,
    h,
    note ? String(note).slice(0, 500) : null,
    new Date().toISOString()
  );
  return { ok: true };
}

module.exports = { migrateChatFeedback, recordFeedback };
