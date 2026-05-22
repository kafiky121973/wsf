const {
  loadDatabaseConfig,
  getDatabaseForm,
  saveDatabaseSettings,
  mysqlConfigured,
  readFileConfig,
} = require("./database-config");
const { testConnectionSync } = require("./mysql-driver");

function configFromBody(body) {
  const driver = (body.db_driver || "sqlite").toLowerCase() === "mysql" ? "mysql" : "sqlite";
  const file = readFileConfig();
  return {
    driver,
    mysql: {
      host: (body.mysql_host || "").trim(),
      port: parseInt(body.mysql_port || "3306", 10) || 3306,
      user: (body.mysql_user || "").trim(),
      password: (body.mysql_pass || "").trim() || file.mysql_pass || process.env.MYSQL_PASSWORD || "",
      database: (body.mysql_database || "shifra").trim(),
    },
  };
}

function testDatabaseConnection(body) {
  const cfg = body && body.mysql_host ? configFromBody(body) : loadDatabaseConfig();
  if (cfg.driver !== "mysql") {
    return { ok: false, error: "اختر MySQL في النموذج." };
  }
  if (!mysqlConfigured(cfg)) {
    return { ok: false, error: "بيانات MySQL غير مكتملة (Host، User، Database)." };
  }
  try {
    testConnectionSync(cfg);
    return { ok: true, message: "الاتصال بـ MySQL ناجح." };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = {
  getDatabaseForm,
  saveDatabaseSettings,
  testDatabaseConnection,
  loadDatabaseConfig,
  mysqlConfigured,
};
