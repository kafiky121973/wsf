/** PWA — تثبيت على Android / Desktop / iOS (Safari) */
(function () {
  var installBar = document.getElementById("pwa-install-bar");
  var installBtn = document.getElementById("pwa-install-btn");
  var installClose = document.getElementById("pwa-install-close");
  var openSafariBtn = document.getElementById("pwa-open-safari");
  var hintNative = document.getElementById("pwa-hint-native");
  var hintIos = document.getElementById("pwa-hint-ios");
  var hintInapp = document.getElementById("pwa-hint-inapp");
  var hintManual = document.getElementById("pwa-hint-manual");
  var deferredPrompt = null;

  function isIos() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function isInAppBrowser() {
    return /CriOS|FxiOS|OPiOS|EdgiOS|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
  }

  function isInstalled() {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.navigator.standalone === true) return true;
    if (localStorage.getItem("shifra_pwa_installed") === "1") return true;
    return false;
  }

  function hideInstallBar() {
    if (!installBar) return;
    installBar.hidden = true;
    installBar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pwa-bar-visible");
  }

  function hideHints() {
    [hintNative, hintIos, hintInapp, hintManual].forEach(function (el) {
      if (el) el.hidden = true;
    });
    if (installBtn) installBtn.hidden = true;
    if (openSafariBtn) openSafariBtn.hidden = true;
  }

  function showInstallBar(mode) {
    if (!installBar || isInstalled()) return;
    if (localStorage.getItem("shifra_pwa_dismissed") === "1") return;

    hideHints();
    installBar.hidden = false;
    installBar.setAttribute("aria-hidden", "false");
    document.body.classList.add("pwa-bar-visible");

    if (mode === "native" && installBtn) {
      installBtn.hidden = false;
      if (hintNative) hintNative.hidden = false;
    } else if (mode === "ios" && hintIos) {
      hintIos.hidden = false;
    } else if (mode === "inapp" && hintInapp) {
      hintInapp.hidden = false;
      if (openSafariBtn) openSafariBtn.hidden = false;
    } else if (hintManual) {
      hintManual.hidden = false;
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
  }

  function addHeaderInstallBtn() {
    if (isInstalled()) return;
    var inner = document.querySelector(".header-inner");
    if (!inner || document.getElementById("pwa-header-install")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "pwa-header-install";
    btn.className = "btn btn-sm btn-outline pwa-header-install";
    btn.setAttribute("aria-label", "تثبيت التطبيق");
    btn.textContent = "تثبيت";
    btn.addEventListener("click", function () {
      localStorage.removeItem("shifra_pwa_dismissed");
      if (deferredPrompt) {
        showInstallBar("native");
        installBtn && installBtn.click();
        return;
      }
      if (isIos() || isInAppBrowser()) {
        window.location.href = "/install";
        return;
      }
      if (installBar && !installBar.hidden) {
        showInstallBar("manual");
        installBar.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        window.location.href = "/install";
      }
    });
    var toggle = document.getElementById("nav-toggle");
    if (toggle) inner.insertBefore(btn, toggle);
    else inner.appendChild(btn);
  }

  if (isInstalled()) {
    hideInstallBar();
    registerServiceWorker();
    return;
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    window.__shifraDeferredInstall = e;
    showInstallBar("native");
  });

  window.addEventListener("appinstalled", function () {
    localStorage.setItem("shifra_pwa_installed", "1");
    deferredPrompt = null;
    hideInstallBar();
    var hb = document.getElementById("pwa-header-install");
    if (hb) hb.remove();
  });

  if (installBtn) {
    installBtn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice.outcome === "accepted") {
          localStorage.setItem("shifra_pwa_installed", "1");
          hideInstallBar();
        }
        deferredPrompt = null;
      });
    });
  }

  if (openSafariBtn) {
    openSafariBtn.addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          alert("تم نسخ الرابط — الصقه في Safari ثم ثبّت التطبيق من زر المشاركة.");
        });
      } else {
        prompt("انسخ الرابط وافتحه في Safari:", url);
      }
    });
  }

  if (installClose) {
    installClose.addEventListener("click", function () {
      localStorage.setItem("shifra_pwa_dismissed", "1");
      hideInstallBar();
    });
  }

  registerServiceWorker();
  addHeaderInstallBtn();

  window.setTimeout(function () {
    if (isInstalled() || deferredPrompt) return;
    if (isIos()) {
      showInstallBar(isInAppBrowser() ? "inapp" : "ios");
    } else if (!window.matchMedia("(display-mode: browser)").matches) {
      /* noop */
    } else {
      showInstallBar("manual");
    }
  }, 2500);
})();
