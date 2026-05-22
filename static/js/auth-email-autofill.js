/** ملء البريد من مدير كلمات المرور / المتصفح */
(function () {
  var el =
    document.getElementById("reg-email") ||
    document.getElementById("forgot-email") ||
    document.querySelector('form input[name="email"]');
  if (!el || el.value) return;

  if (!window.PasswordCredential && !navigator.credentials) return;

  navigator.credentials
    .get({ password: true, mediation: "optional" })
    .then(function (cred) {
      if (!cred) return;
      if (cred.id && !el.value) el.value = cred.id;
    })
    .catch(function () {});
})();
