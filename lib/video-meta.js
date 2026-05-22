const { execFileSync } = require("child_process");
const ffprobe = require("ffprobe-static");

/** يستخرج مدة الفيديو بالثواني من الملف المحلي (ffprobe). */
function getVideoDurationSeconds(absPath) {
  if (!absPath || !ffprobe?.path) return null;
  try {
    const out = execFileSync(
      ffprobe.path,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        absPath,
      ],
      { encoding: "utf8", timeout: 60000 }
    );
    const sec = parseFloat(String(out).trim());
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.round(sec);
  } catch {
    return null;
  }
}

module.exports = { getVideoDurationSeconds };
