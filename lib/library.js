/** مساعدات مكتبة الوعي */

function youtubeEmbedId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function formatDuration(seconds) {
  const s = parseInt(seconds, 10) || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h} س ${m % 60} د`;
  }
  return `${m} د ${r > 0 ? r + " ث" : ""}`.trim();
}

module.exports = { youtubeEmbedId, formatDuration };
