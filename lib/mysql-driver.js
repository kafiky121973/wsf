/**
 * MySQL عبر mysql2 — واجهة متوافقة مع SQLite (prepare/get/all/run) للكود الحالي.
 */
const mysql = require("mysql2/promise");
const { transformSqlForMysql } = require("./sql-dialect");
const { loadDatabaseConfig } = require("./database-config");

let pool = null;
let poolKey = "";

function poolSignature(cfg) {
  const m = cfg.mysql;
  return `${m.host}:${m.port}:${m.user}:${m.database}`;
}

function runSync(promise) {
  let done = false;
  let result;
  let error;
  promise.then(
    (r) => {
      result = r;
      done = true;
    },
    (e) => {
      error = e;
      done = true;
    }
  );
  const wait = require("deasync");
  wait.loopWhile(() => !done);
  if (error) throw error;
  return result;
}

function getPool() {
  const cfg = loadDatabaseConfig();
  if (cfg.driver !== "mysql") {
    throw new Error("DB_DRIVER ليس mysql");
  }
  const sig = poolSignature(cfg);
  if (pool && poolKey === sig) return pool;
  if (pool) {
    runSync(pool.end());
    pool = null;
  }
  const m = cfg.mysql;
  pool = mysql.createPool({
    host: m.host,
    port: m.port,
    user: m.user,
    password: m.password,
    database: m.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "Z",
    multipleStatements: true,
  });
  poolKey = sig;
  return pool;
}

function invalidateMysqlPool() {
  if (pool) {
    try {
      runSync(pool.end());
    } catch (_) {
      /* ignore */
    }
  }
  pool = null;
  poolKey = "";
}

async function testConnection(cfg) {
  const m = cfg.mysql;
  const conn = await mysql.createConnection({
    host: m.host,
    port: m.port,
    user: m.user,
    password: m.password,
    database: m.database,
    charset: "utf8mb4",
  });
  await conn.ping();
  await conn.end();
  return true;
}

function testConnectionSync(cfg) {
  return runSync(testConnection(cfg));
}

function wrapStatement(p, sql) {
  const mysqlSql = transformSqlForMysql(sql);
  return {
    run(...params) {
      const [result] = runSync(p.execute(mysqlSql, params));
      const header = result || {};
      return {
        changes: header.affectedRows ?? 0,
        lastInsertRowid: header.insertId ?? 0,
      };
    },
    get(...params) {
      const [rows] = runSync(p.execute(mysqlSql, params));
      return rows && rows[0] ? rows[0] : undefined;
    },
    all(...params) {
      const [rows] = runSync(p.execute(mysqlSql, params));
      return rows || [];
    },
  };
}

function createMysqlDatabase() {
  const p = getPool();
  return {
    _driver: "mysql",
    exec(sql) {
      const parts = transformSqlForMysql(sql)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        runSync(p.query(part));
      }
    },
    pragma(setting) {
      const s = String(setting || "").trim();
      if (/foreign_keys\s*=\s*ON/i.test(s)) {
        runSync(p.query("SET FOREIGN_KEY_CHECKS = 1"));
      }
    },
    prepare(sql) {
      return wrapStatement(p, sql);
    },
    close() {
      /* pool مشترك — لا يُغلق لكل طلب */
    },
  };
}

async function ready() {
  const cfg = loadDatabaseConfig();
  if (cfg.driver !== "mysql") return;
  getPool();
  runSync(getPool().query("SELECT 1"));
  console.log(
    `[mysql] متصل — ${cfg.mysql.host}:${cfg.mysql.port}/${cfg.mysql.database}`
  );
}

module.exports = {
  createMysqlDatabase,
  getPool,
  invalidateMysqlPool,
  ready,
  testConnection,
  testConnectionSync,
  runSync,
};
