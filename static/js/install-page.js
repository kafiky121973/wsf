/**
 * صفحة /install — إظهار تعليمات الجهاز الحالي + نسخ الرابط + تحذير المتصفحات المدمجة
 */
(function () {
  var page = document.querySelector(".install-page");
  if (!page) return;

  function isIos() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function isInAppBrowser() {
    return /CriOS|FxiOS|OPiOS|EdgiOS|Instagram|FBAN|FBAV|Line\/|WhatsApp|Telegram/i.test(
      navigator.userAgent
    );
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.navigator.standalone === true
    );
  }

  var platform = "desktop";
  if (isIos()) platform = "ios";
  else if (isAndroid()) platform = "android";

  var cards = {
    ios: document.getElementById("install-ios"),
    android: document.getElementById("install-android"),
    desktop: document.getElementById("install-desktop"),
  };

  Object.keys(cards).forEach(function (key) {
    var el = cards[key];
    if (!el) return;
    if (key === platform) {
      el.classList.add("install-card-active");
      el.hidden = false;
    } else {
      el.classList.remove("install-card-active");
      el.hidden = true;
    }
  });

  var otherToggle = document.getElementById("install-show-other");
  if (otherToggle) {
    otherToggle.addEventListener("click", function () {
      Object.keys(cards).forEach(function (key) {
        if (cards[key]) cards[key].hidden = false;
      });
      otherToggle.hidden = true;
    });
  }

  var warn = document.getElementById("install-inapp-warn");
  if (warn && isInAppBrowser()) warn.hidden = false;

  var done = document.getElementById("install-already");
  if (done && isStandalone()) done.hidden = false;

  var copyBtn = document.getElementById("install-copy-url");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var url = window.location.origin + "/";
      function ok() {
        copyBtn.textContent = "تم النسخ ✓";
        setTimeout(function () {
          copyBtn.textContent = "نسخ رابط الموقع";
        }, 2500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok).catch(function () {
          prompt("انسخ الرابط:", url);
        });
      } else {
        prompt("انسخ الرابط:", url);
      }
    });
  }

  var nativeBtn = document.getElementById("install-native-btn");
  if (nativeBtn) {
    var deferred = window.__shifraDeferredInstall;
    if (deferred) {
      nativeBtn.hidden = false;
      nativeBtn.addEventListener("click", function () {
        deferred.prompt();
        deferred.userChoice.then(function (choice) {
          if (choice.outcome === "accepted") {
            localStorage.setItem("shifra_pwa_installed", "1");
            window.location.href = "/";
          }
        });
      });
    }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration("/").then(function (reg) {
      var st = document.getElementById("install-sw-status");
      if (!st) return;
      st.textContent = reg ? "مسجّل — التثبيت مدعوم." : "لم يُسجَّل بعد — أعد تحميل الصفحة من HTTPS.";
    });
  }
})();
