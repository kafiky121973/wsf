/** تحويل معرّفات المستخدمين لأعداد صالحة لـ SQLite (node:sqlite يرفض undefined) */

function parseUserId(raw) {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseSessionUserId(session) {
  if (!session?.userId) return null;
  return parseUserId(session.userId);
}

module.exports = { parseUserId, parseSessionUserId };
