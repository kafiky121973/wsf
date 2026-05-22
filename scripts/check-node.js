const { ready, versionOk, getEngineMode } = require("../lib/sqlite-driver");

ready()
  .then(() => {
    console.log(`✓ Node ${process.version}`);
    console.log(`✓ محرك SQLite: ${getEngineMode()}`);
    if (!versionOk()) {
      console.log("  (Node 18–21: sql.js — لا حاجة لترقية Node على الاستضافة)");
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌", e.message || e);
    process.exit(1);
  });
