const { getDb } = require("./db");
const { runAutoActivationGrace } = require("./member-activation");

let timer = null;

function tick() {
  const db = getDb();
  try {
    const n = runAutoActivationGrace(db);
    if (n > 0) {
      console.log(`[members] تفعيل تلقائي لـ ${n} حساب (بعد ${process.env.MEMBER_AUTO_ACTIVATE_HOURS || "72"} ساعة)`);
    }
  } catch (err) {
    console.error("[members]", err.message || err);
  } finally {
    db.close();
  }
}

function startMemberScheduler() {
  if (process.env.MEMBER_AUTO_ACTIVATE === "0") {
    console.log("[members] التفعيل التلقائي بعد 72 ساعة معطّل (MEMBER_AUTO_ACTIVATE=0)");
    return;
  }
  const intervalMin = parseInt(process.env.MEMBER_AUTO_CHECK_MINUTES || "60", 10);
  const ms = Math.max(15, intervalMin) * 60 * 1000;
  if (timer) clearInterval(timer);
  setTimeout(() => tick(), 15000);
  timer = setInterval(() => tick(), ms);
}

module.exports = { startMemberScheduler, tick };
