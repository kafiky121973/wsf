/**
 * SQLite بدون better-sqlite3:
 * - Node 22.5+ → node:sqlite (مدمج)
 * - Node 18–22 → sql.js (JavaScript فقط — يعمل على Hostinger)
 */
const fs = require("fs");
const path = require("path");

const MIN_NODE = [22, 5, 0];
const pools = new Map();
let engineReady = null;
let SQL = null;
let engineMode = null;

function parseVersion(v) {
  const p = String(v || process.version)
    .replace(/^v/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  return { major: p[0] || 0, minor: p[1] || 0, patch: p[2] || 0 };
}

function versionOk() {
  if (process.env.FORCE_SQLJS === "1") return false;
  const { major, minor, patch } = parseVersion();
  if (major > MIN_NODE[0]) return true;
  if (major < MIN_NODE[0]) return false;
  if (minor > MIN_NODE[1]) return true;
  if (minor < MIN_NODE[1]) return false;
  return patch >= MIN_NODE[2];
}

function persistSqlJs(filePath, sqlDb) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(sqlDb.export()));
}

/** node:sqlite يرفض undefined — نحوّله إلى null */
function normalizeSqlParams(params) {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "bigint") return Number(p);
    return p;
  });
}

function wrapNodeStatement(stmt) {
  return {
    run(...params) {
      return stmt.run(...normalizeSqlParams(params));
    },
    get(...params) {
      return stmt.get(...normalizeSqlParams(params));
    },
    all(...params) {
      return stmt.all(...normalizeSqlParams(params));
    },
  };
}

function createNodeDatabase(filePath) {
  const { DatabaseSync } = require("node:sqlite");
  const raw = new DatabaseSync(filePath);
  return {
    exec(sql) {
      raw.exec(sql);
    },
    pragma(setting) {
      const s = String(setting || "").trim();
      if (!s) return;
      raw.exec(/^PRAGMA/i.test(s) ? s : `PRAGMA ${s}`);
    },
    prepare(sql) {
      return wrapNodeStatement(raw.prepare(sql));
    },
    close() {
      raw.close();
    },
  };
}

function wrapSqlJsDatabase(sqlDb, filePath) {
  const persist = () => persistSqlJs(filePath, sqlDb);

  return {
    exec(sql) {
      sqlDb.exec(sql);
      persist();
    },
    pragma(setting) {
      const s = String(setting || "").trim();
      sqlDb.run(/^PRAGMA/i.test(s) ? s : `PRAGMA ${s}`);
      persist();
    },
    prepare(sql) {
      return {
        run(...params) {
          sqlDb.run(sql, normalizeSqlParams(params));
          const changes = sqlDb.getRowsModified();
          let lastInsertRowid = 0;
          try {
            const res = sqlDb.exec("SELECT last_insert_rowid() AS id");
            if (res[0]?.values[0]) lastInsertRowid = res[0].values[0][0];
          } catch (_) {
            /* ignore */
          }
          persist();
          return { changes, lastInsertRowid };
        },
        get(...params) {
          const stmt = sqlDb.prepare(sql);
          try {
            if (params.length) stmt.bind(normalizeSqlParams(params));
            if (stmt.step()) return stmt.getAsObject();
            return undefined;
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          const stmt = sqlDb.prepare(sql);
          const rows = [];
          try {
            if (params.length) stmt.bind(normalizeSqlParams(params));
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
      };
    },
    close() {
      persist();
    },
  };
}

function openSqlJs(filePath) {
  if (!SQL) throw new Error("sql.js غير جاهز — استدعِ ready() أولاً");
  if (!pools.has(filePath)) {
    const buf = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
    const sqlDb = buf ? new SQL.Database(buf) : new SQL.Database();
    pools.set(filePath, sqlDb);
  }
  return pools.get(filePath);
}

function ready() {
  if (!engineReady) {
    engineReady = (async () => {
      if (versionOk()) {
        engineMode = "node:sqlite";
        console.log(`[sqlite] node:sqlite — Node ${process.version}`);
        return;
      }
      const initSqlJs = require("sql.js");
      SQL = await initSqlJs();
      engineMode = "sql.js";
      console.log(
        `[sqlite] sql.js (بدون native) — Node ${process.version} — مناسب لاستضافة Node 18`
      );
    })();
  }
  return engineReady;
}

function createDatabase(filePath) {
  if (versionOk()) {
    return createNodeDatabase(filePath);
  }
  const sqlDb = openSqlJs(filePath);
  return wrapSqlJsDatabase(sqlDb, filePath);
}

module.exports = {
  createDatabase,
  ready,
  versionOk,
  getEngineMode: () => engineMode,
  MIN_NODE,
};
