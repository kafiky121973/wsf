/** توليد أيقونات PWA من static/icons/logo.webp أو logo.png */
require("./convert-logo.js");

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
