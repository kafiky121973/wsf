const MAX_BODY = 2000;

const EMOJI_PRESETS = [
  "✦", "☪", "🛡", "⚔", "🔥", "💪", "🌿", "📿", "✓", "✗", "❋", "◆",
  "🤲", "☀", "🌙", "💎", "🕋", "📖", "🫒", "🍯", "💧", "🧠", "❤", "🙏",
];

function sanitizeBody(text) {
  const t = String(text || "")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!t) return "";
  return t.slice(0, MAX_BODY);
}

function sendMessage(db, memberId, sender, body) {
  const clean = sanitizeBody(body);
  if (!clean) return null;
  const now = new Date().toISOString();
  const isMember = sender === "member";
  const r = db
    .prepare(
      `INSERT INTO owner_messages (member_id, sender, body, read_by_member, read_by_owner, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(memberId, sender, clean, isMember ? 1 : 0, isMember ? 0 : 1, now);
  return { id: r.lastInsertRowid, body: clean, created_at: now, sender };
}

function listThread(db, memberId, limit = 300) {
  return db
    .prepare(
      `SELECT id, member_id, sender, body, created_at
       FROM owner_messages WHERE member_id = ? ORDER BY created_at ASC LIMIT ?`
    )
    .all(memberId, limit);
}

function markReadByMember(db, memberId) {
  db.prepare(
    `UPDATE owner_messages SET read_by_member = 1
     WHERE member_id = ? AND sender = 'owner' AND read_by_member = 0`
  ).run(memberId);
}

function markReadByOwner(db, memberId) {
  db.prepare(
    `UPDATE owner_messages SET read_by_owner = 1
     WHERE member_id = ? AND sender = 'member' AND read_by_owner = 0`
  ).run(memberId);
}

function countUnreadForMember(db, memberId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM owner_messages
       WHERE member_id = ? AND sender = 'owner' AND read_by_member = 0`
    )
    .get(memberId).c;
}

function countUnreadForOwner(db) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM owner_messages
       WHERE sender = 'member' AND read_by_owner = 0`
    )
    .get().c;
}

function adminInbox(db) {
  return db
    .prepare(
      `SELECT u.id, u.full_name, u.username, u.email, u.role, u.city,
        (SELECT body FROM owner_messages om WHERE om.member_id = u.id ORDER BY om.created_at DESC LIMIT 1) AS last_body,
        (SELECT created_at FROM owner_messages om WHERE om.member_id = u.id ORDER BY om.created_at DESC LIMIT 1) AS last_at,
        (SELECT COUNT(*) FROM owner_messages om WHERE om.member_id = u.id AND om.sender = 'member' AND om.read_by_owner = 0) AS unread
       FROM users u
       WHERE (u.status = 'active' AND u.role IN ('member', 'cadre'))
          OR EXISTS (SELECT 1 FROM owner_messages om2 WHERE om2.member_id = u.id)
       ORDER BY COALESCE(last_at, u.created_at) DESC`
    )
    .all();
}

function getMember(db, memberId) {
  return db
    .prepare(
      `SELECT id, full_name, username, email, role, city, status FROM users WHERE id = ?`
    )
    .get(memberId);
}

module.exports = {
  EMOJI_PRESETS,
  sanitizeBody,
  sendMessage,
  listThread,
  markReadByMember,
  markReadByOwner,
  countUnreadForMember,
  countUnreadForOwner,
  adminInbox,
  getMember,
  MAX_BODY,
};
