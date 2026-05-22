/** عرض وسائط معرض الشهادات */

function mediaKind(post) {
  if (post.youtube_url && youtubeEmbedId(post.youtube_url)) return "youtube";
  if (!post.media_path) return "text";
  const ext = post.media_path.split(".").pop().toLowerCase();
  if (["mp4", "webm", "mov", "ogg"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  return "file";
}

function youtubeEmbedId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function displayAuthor(post) {
  const name = (post.full_name || post.username || "").trim();
  if (!name) return "عضو من المنصة";
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return parts[0] + " " + parts[1].charAt(0) + ".";
  return name;
}

module.exports = { mediaKind, youtubeEmbedId, displayAuthor };
