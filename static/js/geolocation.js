/**
 * تحديد الموقع
 */
window.ShifraGeo = (function () {
  const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
  const API_IP = "/api/location/from-ip";

  function isMobile() {
    return (
      /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
  }

  function pickDistrict(addr) {
    return (
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.district ||
      addr.residential ||
      addr.city_district ||
      addr.hamlet ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      ""
    );
  }

  function pickCity(addr) {
    return addr.city || addr.town || addr.municipality || addr.state_district || addr.state || "";
  }

  async function reverseGeocode(lat, lng) {
    const url =
      NOMINATIM +
      "?format=json&lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lng) +
      "&zoom=18&addressdetails=1&accept-language=ar";
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "ar",
      },
    });
    if (!res.ok) throw new Error("تعذّر تحديد العنوان من الإحداثيات.");
    const data = await res.json();
    const addr = data.address || {};
    const city = pickCity(addr) || "—";
    let district = pickDistrict(addr);
    if (!district || district === city) district = addr.road || addr.suburb || city || "—";
    return {
      country: addr.country || "—",
      city,
      district,
      display: data.display_name || "",
      source: "gps",
    };
  }

  function getPosition(options) {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(Object.assign(new Error("no-api"), { code: -1 }));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  /** محاولات متدرجة: GPS دقيق → شبكة/Wi‑Fi → IP */
  async function resolveCoordinates(setStatus) {
    const mobile = isMobile();
    const attempts = mobile
      ? [
          { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
        ]
      : [
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        ];

    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        if (setStatus) {
          setStatus(
            mobile
              ? i === 0
                ? "جاري تحديد موقعك عبر GPS (موبايل)…"
                : "جاري تحديد موقعك عبر الشبكة…"
              : i === 0
                ? "جاري تحديد موقعك عبر Wi‑Fi / الشبكة (كمبيوتر)…"
                : "محاولة GPS…",
            "pending"
          );
        }
        const pos = await getPosition(attempts[i]);
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          via: i === 0 && attempts[i].enableHighAccuracy ? "gps" : "network",
        };
      } catch (e) {
        lastErr = e;
      }
    }

    if (setStatus) setStatus("جاري تحديد موقعك تقريبياً عبر عنوان IP…", "pending");
    const ipPlace = await fetchIpLocation();
    return {
      lat: ipPlace.lat,
      lng: ipPlace.lng,
      via: "ip",
      place: ipPlace,
    };
  }

  async function fetchIpLocation() {
    const res = await fetch(API_IP, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "تعذّر تحديد الموقع من الشبكة.");
    return data;
  }

  function applyPlace(opts, lat, lng, place, source) {
    opts.latInput.value = String(lat);
    opts.lngInput.value = String(lng);
    opts.countryInput.value = place.country;
    opts.cityInput.value = place.city;
    opts.districtInput.value = place.district;
    if (opts.sourceInput) opts.sourceInput.value = source;
    if (opts.lockedInput) opts.lockedInput.value = "1";
  }

  async function capture(opts) {
    const setStatus = function (msg, type) {
      if (opts.statusEl) {
        opts.statusEl.textContent = msg;
        opts.statusEl.className = "geo-status " + (type || "");
      }
    };

    setStatus("جاري التحديد…", "pending");
    if (opts.triggerBtn) opts.triggerBtn.disabled = true;

    try {
      const coords = await resolveCoordinates(setStatus);
      let place;
      let source;

      if (coords.place) {
        place = coords.place;
        source = "ip";
      } else {
        setStatus("جاري التحديد…", "pending");
        place = await reverseGeocode(coords.lat, coords.lng);
        source = coords.via === "gps" ? "gps" : "network";
        if (place.district === "—" && place.city !== "—") place.district = place.city;
      }

      applyPlace(opts, coords.lat, coords.lng, place, source);

      setStatus(
        "✓ " + place.country + " — " + place.city + " — " + place.district,
        "ok"
      );
      if (opts.submitBtn) opts.submitBtn.disabled = false;
      return { lat: coords.lat, lng: coords.lng, ...place, source };
    } catch (err) {
      let msg = err.message || "فشل تحديد الموقع.";
      if (err.code === 1) msg = "رفض الإذن.";
      if (err.code === 2) msg = "لا إشارة موقع.";
      if (err.code === 3) msg = "انتهت المهلة.";
      setStatus(msg, "error");
      if (opts.lockedInput) opts.lockedInput.value = "";
      if (opts.sourceInput) opts.sourceInput.value = "";
      if (opts.submitBtn) opts.submitBtn.disabled = true;
      throw err;
    } finally {
      if (opts.triggerBtn) opts.triggerBtn.disabled = false;
    }
  }

  function bindForm(opts) {
    if (opts.submitBtn) opts.submitBtn.disabled = true;

    if (opts.allowExisting) {
      const lat0 = parseFloat(opts.latInput && opts.latInput.value);
      const lng0 = parseFloat(opts.lngInput && opts.lngInput.value);
      const country0 = opts.countryInput && opts.countryInput.value;
      if (
        Number.isFinite(lat0) &&
        Number.isFinite(lng0) &&
        country0 &&
        country0 !== "—"
      ) {
        if (opts.lockedInput) opts.lockedInput.value = "1";
        if (opts.submitBtn) opts.submitBtn.disabled = false;
      }
    }

    if (opts.triggerBtn) {
      opts.triggerBtn.addEventListener("click", function (e) {
        e.preventDefault();
        capture(opts);
      });
    }

    opts.form.addEventListener("submit", function (e) {
      if (!opts.lockedInput || opts.lockedInput.value !== "1") {
        e.preventDefault();
        alert("حدّد الموقع أولاً.");
        return;
      }
      if (!opts.latInput.value || !opts.lngInput.value) {
        e.preventDefault();
        alert("الموقع غير مكتمل.");
      }
    });

    const warnTamper = function () {
      if (opts.lockedInput.value === "1") {
        opts.lockedInput.value = "";
        if (opts.sourceInput) opts.sourceInput.value = "";
        if (opts.submitBtn) opts.submitBtn.disabled = true;
        if (opts.statusEl) {
          opts.statusEl.textContent = "أعد تحديد الموقع.";
          opts.statusEl.className = "geo-status error";
        }
      }
    };

    [opts.countryInput, opts.cityInput, opts.districtInput].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", warnTamper);
      el.addEventListener("change", warnTamper);
    });
  }

  return { capture, bindForm, reverseGeocode, isMobile };
})();
