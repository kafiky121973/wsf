/** التحقق من بيانات الموقع المرسلة من الواجهة */

function parseLocationBody(body) {
  const locked = body.location_locked === "1";
  const lat = parseFloat(body.lat);
  const lng = parseFloat(body.lng);
  let country = (body.country || "").trim();
  let city = (body.city || "").trim();
  let district = (body.district || "").trim();
  const source = (body.location_source || "gps").trim();

  const errors = [];
  if (!locked) errors.push("يجب تحديد الموقع — خطوة إلزامية على كل الأجهزة.");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) errors.push("إحداثيات الموقع غير صالحة.");
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) errors.push("إحداثيات الموقع خارج النطاق.");
  if (!country || country === "—") errors.push("لم تُحدَّد الدولة.");
  if (!city || city === "—") errors.push("لم تُحدَّد المدينة.");
  if (!district || district === "—") {
    if (city && city !== "—") district = city;
    else errors.push("لم يُحدَّد الحي.");
  }

  return {
    ok: errors.length === 0,
    errors,
    data: { lat, lng, country, city, district, source },
  };
}

module.exports = { parseLocationBody };
