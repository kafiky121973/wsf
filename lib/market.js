function normalizeCity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, "a")
    .replace(/ى/g, "y")
    .replace(/ة/g, "h")
    .replace(/\s+/g, " ");
}

function citiesMatch(a, b) {
  const na = normalizeCity(a);
  const nb = normalizeCity(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function getMemberCity(db, userId) {
  const row = db.prepare("SELECT city FROM users WHERE id = ?").get(userId);
  return (row?.city || "").trim();
}

function listPointsForMember(db, userId, { activeOnly = true } = {}) {
  const memberCity = getMemberCity(db, userId);
  if (!memberCity) return { city: "", points: [] };

  const sql = activeOnly
    ? "SELECT * FROM distribution_points WHERE is_active = 1 ORDER BY name"
    : "SELECT * FROM distribution_points ORDER BY name";
  const points = db.prepare(sql).all().filter((p) => citiesMatch(memberCity, p.city));
  return { city: memberCity, points };
}

function productsByPointIds(db, pointIds) {
  if (!pointIds.length) return {};
  const placeholders = pointIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM market_products
       WHERE point_id IN (${placeholders}) AND is_available = 1
       ORDER BY sort_order, name`
    )
    .all(...pointIds);
  const map = {};
  rows.forEach((r) => {
    if (!map[r.point_id]) map[r.point_id] = [];
    map[r.point_id].push(r);
  });
  return map;
}

function allProductsGrouped(db) {
  const rows = db
    .prepare(`SELECT * FROM market_products ORDER BY point_id, sort_order, name`)
    .all();
  const map = {};
  rows.forEach((r) => {
    if (!map[r.point_id]) map[r.point_id] = [];
    map[r.point_id].push(r);
  });
  return map;
}

function mapsUrl(lat, lng) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return null;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
}

module.exports = {
  normalizeCity,
  citiesMatch,
  getMemberCity,
  listPointsForMember,
  productsByPointIds,
  allProductsGrouped,
  mapsUrl,
};
