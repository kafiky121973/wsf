/** تحقق البريد — من يُستثنى ومن يحتاج تأكيداً */
function skipsEmailVerify(user) {
  if (!user) return false;
  if (["admin", "supervisor", "designer"].includes(user.role)) return true;
  if (String(user.email || "").toLowerCase().endsWith("@shifra.local")) return true;
  return !!user.email_verified_at;
}

function needsEmailVerify(user) {
  return user && !skipsEmailVerify(user);
}

module.exports = { skipsEmailVerify, needsEmailVerify };
