/** تحديد موقع تقريبي من IP الزائر (كمبيوتر بدون GPS / شبكة) */

async function fetchIpLocation(clientIp) {
  let ip = (clientIp || "").replace(/^::ffff:/, "");
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    // تطوير محلي أو شبكة داخلية — استخدم خدمة بدون IP لترجع IP العام للشبكة
    ip = "";
  }
  const url =
    ip && ip !== "unknown"
      ? `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=ar&fields=status,message,country,regionName,city,district,lat,lon,query`
      : "http://ip-api.com/json/?lang=ar&fields=status,message,country,regionName,city,district,lat,lon,query";

  const res = await fetch(url);
  if (!res.ok) throw new Error("تعذّر تحديد الموقع من الشبكة.");
  const data = await res.json();
  if (data.status !== "success") throw new Error(data.message || "فشل تحديد IP.");

  const city = data.city || data.regionName || "—";
  const district = data.district || data.regionName || city || "—";

  return {
    lat: data.lat,
    lng: data.lon,
    country: data.country || "—",
    city,
    district,
    source: "ip",
    display: [data.country, city, district].filter(Boolean).join(" — "),
  };
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || req.ip || "";
}

module.exports = { fetchIpLocation, getClientIp };
