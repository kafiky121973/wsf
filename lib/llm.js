/**
 * توليد اختياري من سياق الأرشيف فقط (OpenAI-compatible API).
 * فعّل: LLM_ENABLED=1 + OPENAI_API_KEY (أو LLM_API_KEY)
 */

function isLlmEnabled() {
  if (process.env.LLM_ENABLED !== "1") return false;
  return !!(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY);
}

function llmConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    maxTokens: Math.min(parseInt(process.env.LLM_MAX_TOKENS || "900", 10) || 900, 2000),
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || "25000", 10) || 25000,
  };
}

function formatContextBlock(block, index) {
  const n = index + 1;
  if (block.type === "rag") {
    return `[${n}] أرشيف — ${block.title || "موضوع"}\n${block.text}`;
  }
  const kind =
    block.type === "article" ? "مقال" : block.type === "video" ? "فيديو" : "مقطع";
  const extra = block.timestamp ? ` (${block.timestamp})` : "";
  const cat = block.category ? ` · ${block.category}` : "";
  return `[${n}] ${kind}${extra}${cat} — ${block.title}\n${block.excerpt || block.text || ""}`;
}

/**
 * @param {string} question
 * @param {Array<object>} blocks
 * @returns {Promise<string|null>}
 */
async function synthesizeFromContext(question, blocks) {
  if (!isLlmEnabled() || !blocks?.length) return null;

  const { apiKey, baseUrl, model, maxTokens, timeoutMs } = llmConfig();
  const context = blocks
    .slice(0, 6)
    .map((b, i) => formatContextBlock(b, i))
    .join("\n\n");

  const system = `أنت مساعد «شفرة الفطرة» في منصة مكتبة الوعي.
قواعد صارمة:
- أجب بالعربية الفصحى الواضحة (يمكنك «يا بطل» باعتدال).
- استخدم فقط المعلومات في «سياق الأرشيف» أدناه — لا تخترع ولا تستخدم معرفة خارجية.
- إن لم يكفِ السياق، قل ذلك صراحة واقترح صياغة أخرى للسؤال.
- لا تذكر OpenAI ولا أنك نموذج لغوي.
- اختصر إن أمكن (3–8 فقرات قصيرة).`;

  const user = `سياق الأرشيف:\n${context}\n\n---\nسؤال العضو:\n${question}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.35,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[llm] HTTP", res.status, errText.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error("[llm]", e.name === "AbortError" ? "timeout" : e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function llmStatus() {
  return {
    enabled: isLlmEnabled(),
    model: isLlmEnabled() ? llmConfig().model : null,
  };
}

module.exports = { isLlmEnabled, synthesizeFromContext, llmStatus };
