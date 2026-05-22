/** مسار صفحة تثبيت PWA — يُسجَّل بعد تعريف render */
function registerInstallPageRoute(app, render) {
  function handleInstallPage(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const proto =
      req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = req.get("host") || "ark4all.com";
    render(req, res, "install.html", { install_url: `${proto}://${host}/` });
  }

  app.get("/install", handleInstallPage);
  app.get("/install/", handleInstallPage);
}

module.exports = { registerInstallPageRoute };
