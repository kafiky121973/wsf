const path = require("path");
const { createDatabase } = require("../lib/sqlite-driver");

const data = path.join(__dirname, "..", "data");
const files = require("fs").readdirSync(data).filter((f) => f.endsWith(".db"));

for (const f of files) {
  const p = path.join(data, f);
  try {
    const db = createDatabase(p);
    const c = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    console.log("OK", f, "users=", c);
    db.close();
  } catch (e) {
    console.log("FAIL", f, e.message);
  }
}
