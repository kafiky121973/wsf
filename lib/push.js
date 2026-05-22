const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const VAPID_PATH = path.join(__dirname, "..", "data", "vapid.json");
const SITE_URL = (process.env.SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

let _vapid = null;

function loadOrCreateVapid() {
  if (_vapid) return _vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    _vapid = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  } else if (fs.existsSync(VAPID_PATH)) {
    _vapid = JSON.parse(fs.readFileSync(VAPID_PATH, "utf8"));
  } else {
    const keys = webpush.generateVAPIDKeys();
    fs.mkdirSync(path.dirname(VAPID_PATH), { recursive: true });
    fs.writeFileSync(VAPID_PATH, JSON.stringify(keys, null, 2));
    _vapid = keys;
    console.log("[push] تم إنشاء مفاتيح VAPID في data/vapid.json");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:admin@shifra.local`,
    _vapid.publicKey,
    _vapid.privateKey
  );
  return _vapid;
}

function getPublicKey() {
  return loadOrCreateVapid().publicKey;
}

function saveSubscription(db, userId, sub) {
  const now = new Date().toISOString();
  const endpoint = sub.endpoint;
  const keys = sub.keys || {};
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       updated_at = excluded.updated_at`
  ).run(userId, endpoint, keys.p256dh || "", keys.auth || "", now, now);
}

function removeSubscription(db, endpoint) {
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

async function deliverPushRows(db, rows, payload) {
  loadOrCreateVapid();
  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) {
        removeSubscription(db, row.endpoint);
      }
    }
  }
  return { sent, failed, total: rows.length };
}

async function sendPushToUsers(db, userIds, payload) {
  const ids = [...new Set((userIds || []).map((id) => Number(id)).filter((id) => id > 0))];
  if (!ids.length) return { sent: 0, failed: 0, total: 0 };
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id IN (${placeholders})`
    )
    .all(...ids);
  return deliverPushRows(db, rows, payload);
}

async function sendPushToUser(db, userId, payload) {
  return sendPushToUsers(db, [userId], payload);
}

async function sendPushToAll(db, payload) {
  const rows = db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions").all();
  return deliverPushRows(db, rows, payload);
}

function pushPayloadFromDose(dose) {
  const url = dose.link_url
    ? dose.link_url.startsWith("http")
      ? dose.link_url
      : `${SITE_URL}${dose.link_url}`
    : SITE_URL;
  return {
    title: dose.subject,
    body: (dose.content || "").replace(/\n+/g, " ").slice(0, 180),
    icon: `${SITE_URL}/static/icons/icon-192.png`,
    badge: `${SITE_URL}/static/icons/icon-192.png`,
    tag: `dose-${dose.id || Date.now()}`,
    data: { url, doseId: dose.id },
  };
}

module.exports = {
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
  sendPushToUsers,
  sendPushToAll,
  pushPayloadFromDose,
  SITE_URL,
};
