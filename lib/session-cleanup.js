/** إنهاء جلسات تسجيل الدخول لمستخدم محذوف أو مُوقَف */

const path = require("path");
const { createDatabase } = require("./sqlite-driver");

const SESSIONS_DB = path.join(__dirname, "..", "data", "shifra.db");

function destroySessionsForUser(userId) {
  const id = parseInt(String(userId), 10);
  if (!Number.isFinite(id) || id < 1) return 0;

  const db = createDatabase(SESSIONS_DB);
  try {
    const rows = db.prepare("SELECT sid, sess FROM sessions").all();
    let n = 0;
    const del = db.prepare("DELETE FROM sessions WHERE sid = ?");
    for (const row of rows) {
      try {
        const sess = JSON.parse(row.sess);
        if (Number(sess.userId) === id) {
          del.run(row.sid);
          n += 1;
        }
      } catch (_) {
        /* تجاهل جلسة تالفة */
      }
    }
    return n;
  } finally {
    db.close();
  }
}

module.exports = { destroySessionsForUser };
