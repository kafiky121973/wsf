/** جلسات التواجد ومدة الحضور التراكمية */

const ONLINE_MINUTES = parseInt(process.env.ONLINE_MINUTES || "15", 10);

function onlineCutoffIso(minutes = ONLINE_MINUTES) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function sessionDurationSeconds(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.floor((end - start) / 1000);
}

function closePresenceSession(db, sessionId, endedIso) {
  const row = db.prepare("SELECT started_at FROM presence_sessions WHERE id = ?").get(sessionId);
  if (!row) return 0;
  const dur = sessionDurationSeconds(row.started_at, endedIso);
  db.prepare(
    "UPDATE presence_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?"
  ).run(endedIso, dur, sessionId);
  return dur;
}

function closeStaleOpenSessions(db, minutes = ONLINE_MINUTES) {
  const cutoff = onlineCutoffIso(minutes);
  const stale = db
    .prepare(
      `SELECT ps.id, u.last_seen_at
       FROM presence_sessions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.ended_at IS NULL
         AND (u.last_seen_at IS NULL OR u.last_seen_at < ?)`
    )
    .all(cutoff);
  for (const s of stale) {
    closePresenceSession(db, s.id, s.last_seen_at || new Date().toISOString());
  }
  return stale.length;
}

function recordPresencePing(db, userId, nowMs = Date.now()) {
  const id = parseInt(String(userId), 10);
  if (!Number.isFinite(id) || id < 1) return;

  const iso = new Date(nowMs).toISOString();
  const gapMs = ONLINE_MINUTES * 60 * 1000;

  const user = db.prepare("SELECT last_seen_at FROM users WHERE id = ?").get(id);
  const open = db
    .prepare(
      `SELECT id, started_at FROM presence_sessions
       WHERE user_id = ? AND ended_at IS NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get(id);

  const lastMs = user?.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
  const hadGap = !lastMs || nowMs - lastMs > gapMs;

  if (open && hadGap) {
    closePresenceSession(db, open.id, user.last_seen_at || iso);
  }

  if (!open || hadGap) {
    db.prepare("INSERT INTO presence_sessions (user_id, started_at) VALUES (?, ?)").run(id, iso);
  }

  const touchStale = new Date(nowMs - 2 * 60 * 1000).toISOString();
  db.prepare(
    `UPDATE users SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)`
  ).run(iso, id, touchStale);
}

function getPresenceTotalsForUsers(db, users, minutes = ONLINE_MINUTES) {
  closeStaleOpenSessions(db, minutes);
  const now = Date.now();
  const cutoff = onlineCutoffIso(minutes);

  const closedByUser = {};
  db.prepare(
    `SELECT user_id, COALESCE(SUM(duration_seconds), 0) AS total
     FROM presence_sessions WHERE ended_at IS NOT NULL
     GROUP BY user_id`
  )
    .all()
    .forEach((r) => {
      closedByUser[r.user_id] = r.total;
    });

  const openByUser = {};
  db.prepare(
    `SELECT user_id, started_at FROM presence_sessions WHERE ended_at IS NULL`
  )
    .all()
    .forEach((r) => {
      openByUser[r.user_id] = r.started_at;
    });

  let siteTotalSeconds = 0;

  const enriched = users.map((u) => {
    const closed = closedByUser[u.id] || 0;
    const is_online = u.last_seen_at != null && u.last_seen_at >= cutoff;
    let current_session_seconds = 0;
    const sessionStart = openByUser[u.id];
    if (is_online && sessionStart) {
      current_session_seconds = sessionDurationSeconds(sessionStart, new Date(now).toISOString());
    }
    const total_presence_seconds = closed + current_session_seconds;
    siteTotalSeconds += total_presence_seconds;

    return {
      ...u,
      is_online,
      current_session_seconds,
      total_presence_seconds,
      presence_session_start: sessionStart || null,
    };
  });

  return { users: enriched, siteTotalSeconds };
}

function finalizeUserPresence(db, userId) {
  const id = parseInt(String(userId), 10);
  if (!Number.isFinite(id) || id < 1) return;
  const open = db
    .prepare(
      `SELECT ps.id, u.last_seen_at
       FROM presence_sessions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.user_id = ? AND ps.ended_at IS NULL`
    )
    .all(id);
  const now = new Date().toISOString();
  for (const s of open) {
    closePresenceSession(db, s.id, s.last_seen_at || now);
  }
}

function formatDurationSeconds(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s < 60) return `${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h} س ${rm} د` : `${h} س`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} ي ${rh} س` : `${d} ي`;
}

module.exports = {
  ONLINE_MINUTES,
  onlineCutoffIso,
  recordPresencePing,
  closeStaleOpenSessions,
  closePresenceSession,
  getPresenceTotalsForUsers,
  finalizeUserPresence,
  formatDurationSeconds,
  sessionDurationSeconds,
};
