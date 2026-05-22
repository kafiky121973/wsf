/**
 * واجهة سطر أوامر للمساعد — يُستدعى من Flask أو أدوات أخرى.
 * node scripts/rag-chat-cli.js "السؤال" '["slug1"]'
 */
const { getDb } = require("../lib/db");
const { buildChatResponse } = require("../lib/ai");

const question = (process.argv[2] || "").trim();
let excludeSlugs = [];
try {
  excludeSlugs = JSON.parse(process.argv[3] || "[]");
} catch {
  excludeSlugs = [];
}

if (!question) {
  process.stdout.write(JSON.stringify({ ok: false, error: "missing_question" }));
  process.exit(1);
}

(async () => {
  const db = getDb();
  try {
    const chat = await buildChatResponse(db, question, excludeSlugs);
    const payload = {
      ok: true,
      answer: chat.text || "لم أجد رداً مناسباً في الأرشيف.",
      sources: chat.sources || [],
      hasResults: !!chat.hasResults,
      rag: !!chat.rag,
      llm: !!chat.llm,
      confidence: chat.confidence || null,
      title: chat.title || null,
      stage: chat.stage || null,
      slug: chat.slug || null,
      sourceUrl: chat.sourceUrl || null,
      libraryUrl: chat.libraryUrl || null,
      followUps: chat.followUps || { related: null, unrelated: null },
    };
    process.stdout.write(JSON.stringify(payload));
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: String(e.message || e) }));
    process.exit(1);
  } finally {
    db.close();
  }
})();
