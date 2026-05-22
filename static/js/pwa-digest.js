/** جرعات الوعي — إشعارات PWA بعد التثبيت */
(function () {
  var DIGEST_KEY = "shifra_last_digest_at";
  var POLL_MS = 30 * 60 * 1000;

  function isInstalled() {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    if (window.navigator.standalone === true) return true;
    if (localStorage.getItem("shifra_pwa_installed") === "1") return true;
    return false;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = window.atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function showLocalNotification(dose) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var body = (dose.content || "").replace(/\n+/g, " ").slice(0, 160);
    var url = dose.link_url || "/";
    if (url.indexOf("http") !== 0) url = window.location.origin + url;
    var n = new Notification(dose.subject || "جرعة وعي", {
      body: body,
      icon: "/static/icons/icon-192.png",
      tag: "dose-" + (dose.id || dose.sent_at),
      dir: "rtl",
      lang: "ar",
    });
    n.onclick = function () {
      window.focus();
      window.location.href = url;
      n.close();
    };
  }

  function requestPermissionAndSubscribe() {
    if (window.ShifraPush && window.ShifraPush.enable) {
      window.ShifraPush.enable();
    }
  }

  function checkNewDigest() {
    var since = localStorage.getItem(DIGEST_KEY) || "";
    fetch("/api/digest/check?since=" + encodeURIComponent(since), { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.hasNew || !data.dose) return;
        localStorage.setItem(DIGEST_KEY, data.dose.sent_at || new Date().toISOString());
        showLocalNotification(data.dose);
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg.active) {
            reg.active.postMessage({ type: "digest", dose: data.dose });
          }
        });
      })
      .catch(function () {});
  }

  function init() {
    if (!isInstalled()) return;
    navigator.serviceWorker.ready.then(function () {
      if (Notification.permission === "granted" && window.ShifraPush && window.ShifraPush.subscribe) {
        window.ShifraPush.subscribe();
      } else if (Notification.permission === "default") {
        setTimeout(requestPermissionAndSubscribe, 2000);
      }
      checkNewDigest();
      setInterval(checkNewDigest, POLL_MS);
    });
  }

  window.addEventListener("appinstalled", function () {
    localStorage.setItem("shifra_pwa_installed", "1");
    setTimeout(requestPermissionAndSubscribe, 500);
  });
  window.addEventListener("shifra-pwa-installed", function () {
    setTimeout(requestPermissionAndSubscribe, 500);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (ev) {
      if (ev.data && ev.data.type === "open" && ev.data.url) {
        window.location.href = ev.data.url;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
