/** إحصائيات ومفكرة الإنجاز */

function computeJournalStats(entries) {
  const total = entries.length;
  if (!total) {
    return { total: 0, streak: 0, latestMood: null, latestDay: null, firstDate: null };
  }

  const dates = new Set();
  entries.forEach((e) => {
    if (e.created_at) dates.add(e.created_at.slice(0, 10));
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) streak += 1;
    else if (i > 0) break;
  }

  const latest = entries[0];
  const dayNumbers = entries.map((e) => e.day_number).filter((n) => n > 0);
  const latestDay = dayNumbers.length ? Math.max(...dayNumbers) : null;

  return {
    total,
    streak,
    latestMood: latest.mood || null,
    latestDay,
    firstDate: entries[entries.length - 1]?.created_at?.slice(0, 10) || null,
  };
}

const MOODS = [
  { value: "ممتاز", icon: "☀", cls: "mood-great" },
  { value: "جيد", icon: "🌤", cls: "mood-good" },
  { value: "متوسط", icon: "⛅", cls: "mood-ok" },
  { value: "متعب", icon: "🌧", cls: "mood-tired" },
  { value: "صعب", icon: "⛈", cls: "mood-hard" },
];

function moodMeta(mood) {
  return MOODS.find((m) => m.value === mood) || { value: mood, icon: "◈", cls: "mood-ok" };
}

module.exports = { computeJournalStats, MOODS, moodMeta };
