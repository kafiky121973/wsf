(function () {
  const KEY = "shifra.login";

  const params = new URLSearchParams(window.location.search);
  if (params.get("logout") === "1") {
    localStorage.removeItem(KEY);
    const next = params.get("next");
    const q = next ? `?next=${encodeURIComponent(next)}` : "";
    history.replaceState({}, "", window.location.pathname + q);
    return;
  }

  const form = document.querySelector('form[action="/auth/login"]');
  if (!form) return;

  const emailEl = form.querySelector('[name="email"]');
  const rememberEl = form.querySelector("#remember-me");

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved === "object") {
      if (saved.email && emailEl) emailEl.value = saved.email;
      if (rememberEl && typeof saved.remember === "boolean") {
        rememberEl.checked = saved.remember;
      }
    }
  } catch (_) {
    localStorage.removeItem(KEY);
  }

  form.addEventListener("submit", function () {
    const remember = rememberEl ? rememberEl.checked : true;
    localStorage.setItem(
      KEY,
      JSON.stringify({
        email: (emailEl && emailEl.value.trim()) || "",
        remember: remember,
      })
    );
  });
})();
