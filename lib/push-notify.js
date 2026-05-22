const { sendPushToUser, sendPushToUsers, SITE_URL } = require("./push");

function preview(text, max = 120) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function basePayload(title, body, url, tag) {
  return {
    title,
    body: preview(body),
    icon: `${SITE_URL}/static/icons/icon-192.png`,
    badge: `${SITE_URL}/static/icons/icon-192.png`,
    tag: tag || `msg-${Date.now()}`,
    data: { url },
  };
}

function adminRecipientIds(db) {
  return db
    .prepare(
      `SELECT id FROM users WHERE status = 'active' AND role IN ('admin', 'supervisor')`
    )
    .all()
    .map((r) => r.id);
}

/** رد المالك → إشعار للعضو */
async function notifyMemberOfOwnerReply(db, memberId, body) {
  const member = db.prepare("SELECT full_name, username FROM users WHERE id = ?").get(memberId);
  const name = member?.full_name || member?.username || "عضو";
  const payload = basePayload(
    "رد على مقترحاتكم",
    body || "وصلك رد جديد من إدارة الحصن.",
    `${SITE_URL}/owner`,
    `owner-reply-${memberId}`
  );
  payload.data.type = "owner_reply";
  payload.data.memberId = memberId;
  return sendPushToUser(db, memberId, payload);
}

/** رسالة عضو → إشعار للمدير/المشرف */
async function notifyAdminsOfMemberMessage(db, memberId, member, body) {
  const ids = adminRecipientIds(db);
  if (!ids.length) return { sent: 0, failed: 0, total: 0 };
  const name = member?.full_name || member?.username || member?.email || "عضو";
  const payload = basePayload(
    `مقترح جديد — ${name}`,
    body || "رسالة جديدة في مقترحاتكم.",
    `${SITE_URL}/admin/owner-messages?member=${memberId}`,
    `owner-in-${memberId}`
  );
  payload.data.type = "owner_inbox";
  payload.data.memberId = memberId;
  return sendPushToUsers(db, ids, payload);
}

/** إشعار عام (اختياري) */
async function notifyUser(db, userId, { title, body, url, tag }) {
  return sendPushToUser(db, userId, basePayload(title, body, url || SITE_URL, tag));
}

module.exports = {
  notifyMemberOfOwnerReply,
  notifyAdminsOfMemberMessage,
  notifyUser,
  preview,
};
