/** تتبع المتواجدين (last_seen) وإحصائيات الحضور */

const TOUCH_INTERVAL_MS = 2 * 60 * 1000;
const {
  ONLINE_MINUTES,
  onlineCutoffIso,
  recordPresencePing,
} = require("./presence-duration");

const lastTouch = new Map();

function touchLastSeen(userId) {
  const id = parseInt(String(userId ?? ""), 10);
  if (!Number.isFinite(id) || id < 1) return;
  const now = Date.now();
  const prev = lastTouch.get(id) || 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;
  lastTouch.set(id, now);
  const db = require("./db").getDb();
  try {
    recordPresencePing(db, id, now);
  } finally {
    db.close();
  }
}

function getPresenceStats(db, minutes = ONLINE_MINUTES) {
  const cutoff = onlineCutoffIso(minutes);
  const registered = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const active = db.prepare("SELECT COUNT(*) AS c FROM users WHERE status = 'active'").get().c;
  const online = db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE last_seen_at IS NOT NULL AND last_seen_at >= ?")
    .get(cutoff).c;
  return { registered, active, online, onlineMinutes: minutes, cutoff };
}

function isUserOnline(lastSeenAt, minutes = ONLINE_MINUTES) {
  if (!lastSeenAt) return false;
  return lastSeenAt >= onlineCutoffIso(minutes);
}

function enrichUsersPresence(users, minutes = ONLINE_MINUTES) {
  const { getPresenceTotalsForUsers } = require("./presence-duration");
  const db = require("./db").getDb();
  try {
    return getPresenceTotalsForUsers(db, users, minutes).users;
  } finally {
    db.close();
  }
}

module.exports = {
  ONLINE_MINUTES,
  touchLastSeen,
  getPresenceStats,
  isUserOnline,
  enrichUsersPresence,
  onlineCutoffIso,
};
