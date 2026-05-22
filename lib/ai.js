const { searchRag, suggestFollowUpQuestions } = require("./rag-search");
const { searchKnowledge } = require("./knowledge-search");
const { isLlmEnabled, synthesizeFromContext } = require("./llm");

const CONFIDENCE_LABELS = {
  high: "تطابق قوي من الأرشيف",
  medium: "تطابق جيد",
  low: "تطابق تقريبي",
};

function ragResponse(rag, excludeSlugs) {
  const lowNote =
    rag.confidence === "low"
      ? "\n\n— *قد لا يكون هذا الردّ هو الأدق لصياغتك؛ جرّب سؤالاً أدق أو اختر مقترحاً أدناه.*"
      : "";
  return {
    text: (rag.answer || "") + lowNote,
    sources: [],
    hasResults: true,
    rag: true,
    llm: false,
    confidence: rag.confidence || "medium",
    confidenceLabel: CONFIDENCE_LABELS[rag.confidence] || CONFIDENCE_LABELS.medium,
    title: rag.title,
    stage: rag.stage,
    slug: rag.slug,
    sourceUrl: rag.sourceUrl,
    libraryUrl: rag.libraryUrl || null,
    followUps: suggestFollowUpQuestions(rag.slug, excludeSlugs),
    feedbackMode: "rag",
  };
}

function hitsToContextBlocks(hits, weakRag) {
  const blocks = [];
  if (weakRag?.answer) {
    blocks.push({
      type: "rag",
      title: weakRag.title,
      text: String(weakRag.answer).slice(0, 1200),
    });
  }
  hits.forEach((h) => blocks.push({ ...h, excerpt: h.excerpt }));
  return blocks;
}

function formatHitsList(hits) {
  const lines = [
    "وجدت مراجع قريبة في الحصن — قد تحتاج صياغة أدق لسؤالك:",
    "",
  ];
  hits.forEach((h, i) => {
    const sig = h.signature ? ` — [${h.signature}]` : "";
    const ts = h.timestamp ? ` (عند ${h.timestamp})` : "";
    const cat = h.category ? ` · ${h.category}` : "";
    lines.push(`${i + 1}. ${h.title}${ts}${cat}${sig}`);
    lines.push(`   ${h.excerpt}`);
    if (h.url) lines.push(`   ↗ ${h.url}`);
    lines.push("");
  });
  lines.push("—", "لردّ أدق: أضف سؤالك في /admin/knowledge أو فعّل التوليد الذكي (LLM) على السيرفر.");
  return lines.join("\n");
}

function hitsResponse(hits, excludeSlugs, extra = {}) {
  const primary = hits[0];
  return {
    text: formatHitsList(hits),
    sources: hits,
    hasResults: true,
    rag: false,
    llm: false,
    confidence: hits.length >= 2 ? "medium" : "low",
    confidenceLabel: CONFIDENCE_LABELS.medium,
    libraryUrl: primary?.url || null,
    followUps: suggestFollowUpQuestions(null, excludeSlugs),
    feedbackMode: "knowledge",
    ...extra,
  };
}

function emptyResponse(excludeSlugs) {
  return {
    text:
      "لم أجد في أرشيف الحصن مرجعاً مباشراً لسؤالك. صِغ سؤالك بكلمات من موضوعك (مثل: سكر، نوم، فطور، شاشات، 40 يوم)، أو اختر أحد الأسئلة المقترحة.",
    sources: [],
    hasResults: false,
    rag: false,
    llm: false,
    confidence: "none",
    confidenceLabel: null,
    followUps: suggestFollowUpQuestions(null, excludeSlugs),
    feedbackMode: "none",
  };
}

async function buildChatResponse(db, question, excludeSlugs = []) {
  const rag = searchRag(question);
  const useRagFirst = rag && (rag.confidence === "high" || rag.confidence === "medium");

  if (useRagFirst) {
    return ragResponse(rag, excludeSlugs);
  }

  const hits = searchKnowledge(db, question, 5);
  const weakRag = rag && rag.confidence === "low" ? rag : null;

  if (isLlmEnabled() && (hits.length > 0 || weakRag)) {
    const blocks = hitsToContextBlocks(hits, weakRag);
    const synthesized = await synthesizeFromContext(question, blocks);
    if (synthesized) {
      const primary = hits[0];
      return {
        text: synthesized,
        sources: hits.slice(0, 3),
        hasResults: true,
        rag: false,
        llm: true,
        confidence: weakRag ? "low" : "medium",
        confidenceLabel: "صياغة من مراجع الأرشيف (ذكاء مساعد)",
        title: weakRag?.title || primary?.title || null,
        stage: weakRag?.stage || null,
        slug: weakRag?.slug || null,
        sourceUrl: weakRag?.sourceUrl || null,
        libraryUrl: weakRag?.libraryUrl || primary?.url || null,
        followUps: suggestFollowUpQuestions(weakRag?.slug || null, excludeSlugs),
        feedbackMode: "llm",
      };
    }
  }

  if (weakRag) {
    return ragResponse(weakRag, excludeSlugs);
  }

  if (hits.length) {
    return hitsResponse(hits, excludeSlugs);
  }

  return emptyResponse(excludeSlugs);
}

function generateAiResponse(db, question) {
  return buildChatResponse(db, question).then((r) => r.text);
}

module.exports = {
  buildChatResponse,
  generateAiResponse,
  searchKnowledge,
  CONFIDENCE_LABELS,
};
