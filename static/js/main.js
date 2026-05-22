// شفرة الفطرة — scripts
document.querySelectorAll(".nav-main a").forEach(function (a) {
  if (a.pathname === window.location.pathname) a.classList.add("active");
});

(function () {
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("nav-main");
  if (!toggle || !nav) return;

  function closeNav() {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("nav-open", open);
  });

  nav.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
})();
