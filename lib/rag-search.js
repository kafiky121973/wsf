const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "data", "rag_qa_mapping.csv");

const SLUG_ROUTES = {
  "forty-days": "/library/level/1",
  "dates-butter-breakfast": "/library/search?q=فطور",
  "cut-sugar-protocol": "/library/search?q=سكر",
  "sovereignty-basics": "/library/search?q=فطرة",
  "bliss-point": "/library/search?q=سكر",
  "digital-sovereignty": "/library/search?q=شاشات",
  "sovereign-vegetables": "/library/search?q=خضار",
  "sovereign-beverages": "/library/search?q=ماء",
  "raw-milk-protocol": "/library/search?q=حليب",
  "sovereign-sleep": "/library/search?q=نوم",
  "honeycomb-cells": "/library/search?q=اعتصام",
  "khalifa-identity": "/library/search?q=خليفة",
  "liberation-sujud": "/library/level/3",
  "gradual-liberation": "/library/search?q=تدرج",
  "legumes-protocol": "/library/search?q=بقوليات",
  "microwave-truth": "/library/search?q=ميكروويف",
  "fitra-economy": "/library/search?q=اقتصاد",
  "strength-tayyibat": "/library/search?q=طيبات",
  "quran-tadabbur": "/library/level/3",
  "gut-mihrab-link": "/library/search?q=خشوع",
  "sovereign-contentment": "/library/search?q=استغناء",
};

const STAGE_HINTS = {
  الاستيقاظ: ["استيقاظ", "وعي", "منظومة", "فطرة", "دوبامين", "شاشات", "خديعة"],
  التطهير: ["تطهير", "40", "أربعين", "سكر", "دقيق", "زيت", "صيام", "خبائث", "قطع"],
  الاعتصام: ["اعتصام", "جماعة", "نحل", "صلاة", "سجود", "قرآن", "تدبر", "تدرج"],
  "سيادة والإنتاج": ["سيادة", "خليفة", "اقتصاد", "إنتاج", "قوة", "استغناء"],
};

let _cache = null;
let _cacheMtime = 0;

function getCsvMtime() {
  try {
    return fs.statSync(CSV_PATH).mtimeMs;
  } catch {
    return 0;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      if (ch === "\r") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.length > 1 || row[0]) rows.push(row);
  }
  return rows;
}

function loadRagRows(force = false) {
  const mtime = getCsvMtime();
  if (!force && _cache && _cacheMtime === mtime) return _cache;
  _cacheMtime = mtime;
  if (!fs.existsSync(CSV_PATH)) {
    _cache = [];
    return _cache;
  }
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(raw);
  if (table.length < 2) {
    _cache = [];
    return _cache;
  }
  const header = table[0].map((h) => String(h || "").trim().replace(/^\uFEFF/, ""));
  _cache = table.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, i) => {
      if (key) obj[key] = (cells[i] || "").trim();
    });
    return obj;
  });
  rebuildSlugIndex(_cache);
  return _cache;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u061F\u061B\u060C\u066C\u066B\u066A\u0640]/g, " ")
    .replace(/[؟?!.,;:()«»]/g, " ")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "ما",
  "هل",
  "من",
  "في",
  "عن",
  "الى",
  "الي",
  "على",
  "ان",
  "ان",
  "لا",
  "لي",
  "لم",
  "لن",
  "هذا",
  "هذه",
  "ذلك",
  "كيف",
  "متى",
  "اين",
  "لماذا",
  "ماذا",
  "ايه",
  "يا",
  "انا",
  "انت",
  "هو",
  "هي",
  "هم",
  "نحن",
  "اريد",
  "عايز",
  "عاوز",
  "ممكن",
  "لو",
  "هل",
  "the",
  "is",
  "are",
  "and",
  "or",
  "to",
  "of",
  "a",
  "an",
]);

const TOKEN_ALIASES = {
  سمن: ["زبده", "زبدة", "دهن"],
  زبده: ["سمن", "زبدة"],
  زبدة: ["سمن", "زبده"],
  دايت: ["محليات", "سكر"],
  سكر: ["سكريات", "محليات", "جلوكوز"],
  نوم: ["نوم", "سهر", "أرق"],
  شاشه: ["شاشات", "جوال", "تيك"],
  شاشات: ["شاشه", "جوال", "تيك"],
  فطور: ["إفطار", "فطار", "تمر"],
  صيام: ["صوم", "صيام"],
  قهوه: ["قهوة", "كافيين"],
  قهوة: ["قهوه", "كافيين"],
};

function expandTokens(tokens) {
  const out = [...tokens];
  for (const t of tokens) {
    const extra = TOKEN_ALIASES[t];
    if (extra) out.push(...extra.map((x) => normalize(x)));
  }
  return [...new Set(out)];
}

function stripTokenPrefixes(w) {
  let s = String(w || "");
  if (s.startsWith("وبال") && s.length > 5) s = s.slice(4);
  else if (s.startsWith("وب") && s.length > 3) s = s.slice(2);
  else if (s.startsWith("وال") && s.length > 4) s = s.slice(3);
  else if (s.startsWith("و") && s.length > 2) s = s.slice(1);
  if (s.startsWith("بال") && s.length > 4) s = s.slice(3);
  else if (s.startsWith("ال") && s.length > 3) s = s.slice(2);
  else if (s.startsWith("ب") && s.length > 2) s = s.slice(1);
  return s.replace(/[^\w\u0600-\u06FF]/g, "");
}

function tokenize(query) {
  const base = normalize(query)
    .split(/\s+/)
    .map(stripTokenPrefixes)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return expandTokens(base);
}

function arabicRoot(token) {
  return String(token || "")
    .replace(/^(?:بال|ال|و)/, "")
    .replace(/[هةيى]$/, "")
    .slice(0, 4);
}

function tokenMatchesWord(token, word) {
  if (!token || !word) return false;
  if (token === word) return true;
  if (token.length >= 4 && word.includes(token)) return true;
  if (word.length >= 4 && token.includes(word)) return true;
  const rt = arabicRoot(token);
  const rw = arabicRoot(word);
  if (rt.length >= 3 && rw.length >= 3 && rt === rw) return true;
  return false;
}

function tokenVariants(token) {
  const variants = [token];
  if (token.startsWith("بال") && token.length > 4) variants.push(token.slice(3));
  if (token.startsWith("ال") && token.length > 3) variants.push(token.slice(2));
  if (token.startsWith("و") && token.length > 3) variants.push(token.slice(1));
  return variants;
}

function matchedTokenCount(haystack, tokens) {
  const words = normalize(haystack)
    .split(/\s+/)
    .map((w) => w.replace(/[^\w\u0600-\u06FF]/g, ""))
    .filter((w) => w.length >= 2);
  if (!words.length || !tokens.length) return 0;
  let count = 0;
  for (const token of tokens) {
    const variants = tokenVariants(token);
    if (variants.some((v) => words.some((w) => tokenMatchesWord(v, w)))) count += 1;
  }
  return count;
}

function scoreTokens(haystack, tokens) {
  return matchedTokenCount(haystack, tokens);
}

function detectStage(query) {
  const q = normalize(query);
  let best = null;
  let bestScore = 0;
  for (const [stage, hints] of Object.entries(STAGE_HINTS)) {
    let s = 0;
    for (const h of hints) {
      if (q.includes(normalize(h))) s += 1;
    }
    if (s > bestScore) {
      bestScore = s;
      best = stage;
    }
  }
  return bestScore > 0 ? best : null;
}

const STAGE_LIBRARY_ROUTES = {
  الاستيقاظ: "/library/search?q=وعي",
  التطهير: "/library/level/1",
  الاعتصام: "/library/level/3",
  "سيادة والإنتاج": "/library/level/2",
};

let _slugIndex = null;

function rebuildSlugIndex(rows) {
  _slugIndex = new Map();
  for (const row of rows) {
    if (row.slug) _slugIndex.set(row.slug, row);
  }
}

function getRowBySlug(slug) {
  const rows = loadRagRows();
  if (!_slugIndex || _slugIndex.size !== rows.length) rebuildSlugIndex(rows);
  return _slugIndex.get(slug) || null;
}

/** صفحة مصدر عامة — متاحة للزائر */
function sourceUrlFor(row) {
  if (!row?.slug) return "/cadres";
  return `/waei/source/${encodeURIComponent(row.slug)}`;
}

/** رابط المكتبة (يتطلب عضواً نشطاً) */
function libraryDeepLinkFor(row) {
  if (!row) return null;
  if (SLUG_ROUTES[row.slug]) return SLUG_ROUTES[row.slug];
  if (row.stage && STAGE_LIBRARY_ROUTES[row.stage]) return STAGE_LIBRARY_ROUTES[row.stage];
  const q = (row.title || row.tags || "").split(/[;,]/)[0]?.trim();
  return q ? `/library/search?q=${encodeURIComponent(q)}` : "/library";
}

function searchRag(query, minScore) {
  const rows = loadRagRows();
  if (!rows.length) return null;

  const tokens = tokenize(query);
  if (!tokens.length) return null;

  const stageHint = detectStage(query);
  let best = null;
  let bestScore = 0;
  let secondScore = 0;

  for (const row of rows) {
    const tagText = (row.tags || "").replace(/[;,]/g, " ");
    const questionScore = scoreTokens(row.user_question, tokens) * 5;
    const titleScore = scoreTokens(row.title, tokens) * 4;
    const tagScore = scoreTokens(tagText, tokens) * 3;
    const focusScore = questionScore + titleScore + tagScore;

    // لا نعتمد على نص الإجابة الطويل — يسبب تطابقات خاطئة
    let score = focusScore;
    if (stageHint && row.stage === stageHint && focusScore > 0) score += 1;

    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = row;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (!best || bestScore <= 0) return null;

  const focusText = [best.user_question, best.title, (best.tags || "").replace(/[;,]/g, " ")].join(" ");
  const matchedFocus = matchedTokenCount(focusText, tokens);
  const minMatched =
    tokens.length >= 2 ? Math.max(2, Math.ceil(tokens.length * 0.5)) : 1;
  const requiredScore = minScore ?? Math.max(5, tokens.length * 3);

  if (matchedFocus < minMatched || bestScore < requiredScore) return null;

  // إذا كان الفارق بين أفضل نتيجتين ضئيلاً والتطابق ضعيفاً — لا نجيب
  if (secondScore > 0 && bestScore - secondScore < 2 && matchedFocus < tokens.length) return null;

  const confidence = computeRagConfidence(bestScore, secondScore, matchedFocus, tokens.length);

  return {
    id: best.id,
    title: best.title,
    stage: best.stage,
    tags: best.tags,
    answer: best.optimized_answer || best.answer || "",
    slug: best.slug,
    sourceUrl: sourceUrlFor(best),
    libraryUrl: libraryDeepLinkFor(best),
    score: bestScore,
    confidence,
  };
}

/** high | medium | low — للواجهة وقرار استخدام LLM */
function computeRagConfidence(bestScore, secondScore, matchedFocus, tokenCount) {
  const gap = bestScore - (secondScore || 0);
  if (bestScore >= Math.max(12, tokenCount * 5) && gap >= 3 && matchedFocus >= tokenCount) {
    return "high";
  }
  if (bestScore >= Math.max(8, tokenCount * 3) && gap >= 2) return "medium";
  return "low";
}

function reloadRag() {
  _cache = null;
  _cacheMtime = 0;
  _slugIndex = null;
  return loadRagRows(true).length;
}

function parseTags(tags) {
  return new Set(
    String(tags || "")
      .split(/[;,،]/)
      .map((t) => t.trim())
      .filter(Boolean)
  );
}

function tagsOverlap(a, b) {
  const ta = parseTags(a);
  const tb = parseTags(b);
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}

function pickRandom(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function toSuggestion(row, kind) {
  if (!row || !row.user_question) return null;
  return {
    question: row.user_question,
    label: row.title || row.user_question.slice(0, 48),
    slug: row.slug,
    stage: row.stage || "",
    kind,
  };
}

/** سؤال مرتبط + سؤال خارج الموضوع — للعرض بعد كل إجابة */
function suggestFollowUpQuestions(currentSlug, excludeSlugs = []) {
  const rows = loadRagRows().filter((r) => r.user_question && r.slug);
  if (rows.length < 2) return { related: null, unrelated: null };

  const exclude = new Set([...(excludeSlugs || []), currentSlug].filter(Boolean));
  let pool = rows.filter((r) => !exclude.has(r.slug));
  if (pool.length < 2) {
    pool = rows.filter((r) => r.slug !== currentSlug);
  }
  if (pool.length < 1) return { related: null, unrelated: null };

  const current = currentSlug ? rows.find((r) => r.slug === currentSlug) : null;

  let relatedPool = [];
  let unrelatedPool = [];

  if (current) {
    relatedPool = pool.filter(
      (r) => r.stage === current.stage || tagsOverlap(r.tags, current.tags)
    );
    unrelatedPool = pool.filter(
      (r) => r.stage !== current.stage && !tagsOverlap(r.tags, current.tags)
    );
  } else {
    relatedPool = [...pool];
    unrelatedPool = pool.filter((r) => r.stage !== relatedPool[0]?.stage);
  }

  if (!relatedPool.length) relatedPool = pool.filter((r) => r.slug !== unrelatedPool[0]?.slug);
  if (!unrelatedPool.length) {
    unrelatedPool = pool.filter(
      (r) => r.slug !== relatedPool[0]?.slug && r.stage !== relatedPool[0]?.stage
    );
  }
  if (!unrelatedPool.length) {
    unrelatedPool = pool.filter((r) => r.slug !== relatedPool[0]?.slug);
  }

  const related = toSuggestion(pickRandom(relatedPool), "related");
  let unrelated = toSuggestion(
    pickRandom(unrelatedPool.filter((r) => r.slug !== related?.slug)),
    "unrelated"
  );

  if (related && unrelated && related.slug === unrelated.slug) {
    unrelated = toSuggestion(
      pickRandom(unrelatedPool.filter((r) => r.slug !== related.slug)),
      "unrelated"
    );
  }

  return { related, unrelated };
}

module.exports = {
  searchRag,
  loadRagRows,
  reloadRag,
  sourceUrlFor,
  libraryDeepLinkFor,
  getRowBySlug,
  tokenize,
  matchedTokenCount,
  computeRagConfidence,
  suggestFollowUpQuestions,
};
