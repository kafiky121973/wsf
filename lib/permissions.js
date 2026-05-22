const RESOURCE_LABELS = {
  users: "المستخدمون",
  permissions: "الصلاحيات",
  library: "المكتبة",
  community: "المجتمع",
  cadres: "الكوادر",
  market: "سوق الطيبات",
  newsletter: "جرعات الوعي",
  theme: "المظهر",
  consultations: "الاستشارات",
  knowledge: "المعرفة",
  journals: "اليوميات",
};

function hasPermission(role, resource, action = "read", db) {
  if (role === "admin") return true;
  const col = { read: "can_read", write: "can_write", delete: "can_delete" }[action] || "can_read";
  const row = db
    .prepare(`SELECT ${col} AS v FROM role_permissions WHERE role = ? AND resource = ?`)
    .get(role, resource);
  return !!(row && row.v === 1);
}

module.exports = { RESOURCE_LABELS, hasPermission };
