/** تعريف عناصر القائمة العلوية وربطها بالأدوار (قابل للتعديل من لوحة الإدارة) */

const NAV_ROLES = ["guest", "rejected", "pending", "member", "cadre", "supervisor", "admin", "designer"];

const MENU_CATALOG = {
  home: { href: "/", label: "الحصن", defaultSort: 10 },
  gallery: { href: "/gallery", label: "معرض الشهادات", defaultSort: 20 },
  login: { href: "/auth/login", label: "دخول", defaultSort: 30 },
  join: { href: "/join/account", label: "انضمام", defaultSort: 40, css_class: "btn btn-gold btn-sm" },
  account_status: { href: "/join/status", label: "حالة الحساب", defaultSort: 30 },
  cadres: { href: "/cadres", label: "مساعدك", defaultSort: 50 },
  library: { href: "/library", label: "مكتبة الوعي", defaultSort: 60 },
  community: { href: "/community", label: "مجتمع الخلفاء", defaultSort: 70 },
  market: { href: "/market", label: "سوق الطيبات", defaultSort: 80 },
  owner_member: { href: "/owner", label: "مقترحاتكم", defaultSort: 90, badge: "owner_unread" },
  owner_admin: { href: "/admin/owner-messages", label: "مقترحاتكم", defaultSort: 90, badge: "owner_unread" },
  consult: { href: "/cadres/consult", label: "استشارة رسمية", defaultSort: 100 },
  my_consultations: { href: "/cadres/my-consultations", label: "استشاراتي", defaultSort: 110 },
  cadre_panel: { href: "/cadres/panel", label: "لوحة المستشار", defaultSort: 120 },
  knowledge: { href: "/admin/knowledge", label: "بيانات المساعد", defaultSort: 130 },
  admin: { href: "/admin", label: "الإدارة", defaultSort: 140 },
  designer: { href: "/designer", label: "المصمم", defaultSort: 150 },
  logout: { href: "/auth/logout", label: "خروج", defaultSort: 900, css_class: "nav-logout" },
};

const DEFAULT_ROLE_NAV = {
  guest: ["home", "gallery", "login", "join"],
  rejected: ["home", "gallery", "account_status", "logout"],
  pending: ["home", "gallery", "cadres", "library", "community", "market", "logout"],
  member: ["home", "gallery", "cadres", "library", "community", "market", "owner_member", "logout"],
  cadre: ["home", "gallery", "cadres", "library", "community", "market", "owner_member", "logout"],
  supervisor: [
    "home",
    "gallery",
    "cadres",
    "library",
    "community",
    "market",
    "owner_admin",
    "consult",
    "my_consultations",
    "cadre_panel",
    "knowledge",
    "admin",
    "designer",
    "logout",
  ],
  admin: [
    "home",
    "gallery",
    "cadres",
    "library",
    "community",
    "market",
    "owner_admin",
    "consult",
    "my_consultations",
    "cadre_panel",
    "knowledge",
    "admin",
    "designer",
    "logout",
  ],
  designer: ["home", "gallery", "designer", "logout"],
};

function catalogList() {
  return Object.entries(MENU_CATALOG).map(([key, meta]) => ({
    key,
    ...meta,
  }));
}

function seedRoleNav(db, role = null) {
  const ins = db.prepare(
    `INSERT OR REPLACE INTO role_nav_items (role, item_key, enabled, sort_order) VALUES (?, ?, 1, ?)`
  );
  const roles = role ? [role] : NAV_ROLES;
  for (const r of roles) {
    const keys = DEFAULT_ROLE_NAV[r] || [];
    keys.forEach((key, i) => {
      const meta = MENU_CATALOG[key];
      if (!meta) return;
      ins.run(r, key, meta.defaultSort + i);
    });
  }
}

function ensureRoleNavSeeded(db) {
  const n = db.prepare("SELECT COUNT(*) AS c FROM role_nav_items").get().c;
  if (n === 0) seedRoleNav(db);
}

function navRoleForUser(user, is_guest) {
  if (is_guest || !user) return "guest";
  if (user.status === "rejected") return "rejected";
  return user.role || "member";
}

function resolveNavLinks(db, { user, is_guest }) {
  ensureRoleNavSeeded(db);
  const role = navRoleForUser(user, is_guest);
  const rows = db
    .prepare(
      `SELECT item_key, sort_order FROM role_nav_items
       WHERE role = ? AND enabled = 1
       ORDER BY sort_order ASC, item_key ASC`
    )
    .all(role);

  if (!rows.length && DEFAULT_ROLE_NAV[role]) {
    seedRoleNav(db, role);
    return resolveNavLinks(db, { user, is_guest });
  }

  return rows
    .map((row) => {
      const meta = MENU_CATALOG[row.item_key];
      if (!meta) return null;
      return {
        key: row.item_key,
        href: meta.href,
        label: meta.label,
        css_class: meta.css_class || "",
        badge: meta.badge || null,
      };
    })
    .filter(Boolean);
}

function getRoleNavState(db, role) {
  ensureRoleNavSeeded(db);
  const rows = db
    .prepare("SELECT item_key, enabled, sort_order FROM role_nav_items WHERE role = ?")
    .all(role);
  const byKey = Object.fromEntries(rows.map((r) => [r.item_key, r]));
  return catalogList().map((item) => {
    const row = byKey[item.key];
    const inDefault = (DEFAULT_ROLE_NAV[role] || []).includes(item.key);
    return {
      ...item,
      enabled: row ? row.enabled === 1 : inDefault,
      sort_order: row ? row.sort_order : item.defaultSort,
    };
  });
}

function saveRoleNav(db, role, items) {
  if (!NAV_ROLES.includes(role)) return { ok: false, error: "دور غير صالح." };
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO role_nav_items (role, item_key, enabled, sort_order) VALUES (?, ?, ?, ?)`
  );
  for (const { key, enabled, sort_order } of items) {
    if (!MENU_CATALOG[key]) continue;
    upsert.run(role, key, enabled ? 1 : 0, sort_order);
  }
  return { ok: true };
}

function parseRoleNavBody(body, role) {
  return catalogList().map((item) => {
    const enabled = body[`enabled_${item.key}`] === "1" || body[`enabled_${item.key}`] === "on";
    let sort = parseInt(body[`sort_${item.key}`], 10);
    if (!Number.isFinite(sort)) sort = item.defaultSort;
    return { key: item.key, enabled, sort_order: sort };
  });
}

module.exports = {
  NAV_ROLES,
  MENU_CATALOG,
  DEFAULT_ROLE_NAV,
  catalogList,
  seedRoleNav,
  ensureRoleNavSeeded,
  resolveNavLinks,
  getRoleNavState,
  saveRoleNav,
  parseRoleNavBody,
  navRoleForUser,
};
