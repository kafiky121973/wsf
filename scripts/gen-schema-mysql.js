const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "lib", "schema.sql");
const out = path.join(__dirname, "..", "lib", "schema-mysql.sql");
let s = fs.readFileSync(src, "utf8");
s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "INT AUTO_INCREMENT PRIMARY KEY");
s = s.replace(/CREATE INDEX IF NOT EXISTS/g, "CREATE INDEX");
s = s.replace(/\bREAL\b/g, "DOUBLE");
s = s.replace(
  /CREATE TABLE IF NOT EXISTS (site_settings|theme_settings|newsletter_settings) \(\s*key TEXT/g,
  "CREATE TABLE IF NOT EXISTS $1 (\n    `key` VARCHAR(191)"
);
s += `

CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR(128) PRIMARY KEY,
    sess MEDIUMTEXT NOT NULL,
    expire BIGINT NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions(expire);
`;
fs.writeFileSync(out, s);
console.log("Wrote", out);
