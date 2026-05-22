/** إشعارات Web Push — مقترحاتكم ورسائل التطبيق (حتى والتطبيق مغلق) */
(function () {
  if (!document.body.dataset.userLoggedIn) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  var bar = document.getElementById("push-notify-bar");
  var enableBtn = document.getElementById("push-notify-enable");
  var dismissBtn = document.getElementById("push-notify-dismiss");
  var DISMISS_KEY = "shifra_push_dismissed";

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = window.atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function hideBar() {
    if (!bar) return;
    bar.hidden = true;
    bar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("push-bar-visible");
  }

  function showBar() {
    if (!bar || localStorage.getItem(DISMISS_KEY) === "1") return;
    if (Notification.permission !== "default") return;
    bar.hidden = false;
    bar.setAttribute("aria-hidden", "false");
    document.body.classList.add("push-bar-visible");
  }

  function subscribe(reg) {
    return fetch("/api/push/vapid-public-key", { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.publicKey) return null;
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      })
      .then(function (sub) {
        if (!sub) return;
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      })
      .then(function () {
        hideBar();
      })
      .catch(function () {});
  }

  function enableNotifications() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") return;
      navigator.serviceWorker.ready.then(subscribe);
    });
  }

  function ensureServiceWorker() {
    return navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  function init() {
    ensureServiceWorker().then(function () {
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      if (Notification.permission === "granted") {
        return subscribe(reg);
      }
      if (Notification.permission === "default") {
        setTimeout(showBar, 1500);
      }
    });
  }

  if (enableBtn) {
    enableBtn.addEventListener("click", function () {
      enableNotifications();
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener("click", function () {
      localStorage.setItem(DISMISS_KEY, "1");
      hideBar();
    });
  }

  window.ShifraPush = { enable: enableNotifications, subscribe: function () {
    navigator.serviceWorker.ready.then(subscribe);
  }};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
