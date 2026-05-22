(function () {
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var messages = document.getElementById("chat-messages");
  var sendBtn = document.getElementById("chat-send");
  var suggestions = document.getElementById("chat-suggestions");
  var suggestionsWrap = document.getElementById("chat-suggestions-wrap");
  var suggestionsLabel = document.getElementById("chat-suggestions-label");
  if (!form || !input || !messages) return;

  var seenSlugs = [];
  var lastQuestion = "";
  var lastFeedbackMeta = { slug: "", answerMode: "" };
  var feedbackSent = false;

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatAnswer(text) {
    var html = escapeHtml(text || "");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/«(.+?)»/g, "<em>$1</em>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function chipLabel(item) {
    if (!item) return "";
    if (item.label && item.label.length <= 48) return item.label;
    var q = item.question || "";
    return q.length > 52 ? q.slice(0, 50) + "…" : q;
  }

  function bindChip(btn) {
    btn.addEventListener("click", function () {
      sendQuestion(btn.getAttribute("data-q"));
    });
  }

  function bindAllChips(root) {
    if (!root) return;
    root.querySelectorAll(".chat-chip").forEach(bindChip);
  }

  function buildFollowUpChips(followUps) {
    if (!followUps || (!followUps.related && !followUps.unrelated)) return null;

    var box = document.createElement("div");
    box.className = "chat-suggestions";

    function addChip(item, cssClass) {
      if (!item || !item.question) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-chip " + cssClass;
      btn.setAttribute("data-q", item.question);
      if (item.slug) btn.setAttribute("data-slug", item.slug);
      btn.title = item.question;
      btn.textContent = chipLabel(item);
      bindChip(btn);
      box.appendChild(btn);
    }

    addChip(followUps.related, "chat-chip-related");
    addChip(followUps.unrelated, "chat-chip-unrelated");
    return box.childElementCount > 0 ? box : null;
  }

  function updateSuggestionBar(followUps) {
    if (!suggestions) return;
    suggestions.innerHTML = "";

    var chips = buildFollowUpChips(followUps);
    if (!chips) {
      if (suggestionsWrap) suggestionsWrap.hidden = true;
      return;
    }

    if (suggestionsWrap) suggestionsWrap.hidden = false;
    if (suggestionsLabel) {
      suggestionsLabel.textContent = "مواضيع مقترحة — جرّب سؤالاً:";
    }

    while (chips.firstChild) {
      suggestions.appendChild(chips.firstChild);
    }
  }

  function addMessage(text, role, meta) {
    meta = meta || {};
    var wrap = document.createElement("div");
    wrap.className = "chat-msg chat-msg-" + (role === "user" ? "user" : "bot");

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble";

    if (meta.confidenceLabel) {
      var conf = document.createElement("span");
      conf.className = "chat-confidence-badge" + (meta.confidence === "low" ? " chat-confidence-low" : "");
      if (meta.llm) conf.className += " chat-confidence-llm";
      conf.textContent = meta.confidenceLabel;
      bubble.appendChild(conf);
    }

    if (role === "bot" && meta.rag) {
      if (meta.stage) {
        var stage = document.createElement("span");
        stage.className = "chat-stage-badge";
        stage.textContent = meta.stage;
        bubble.appendChild(stage);
      }
      if (meta.title) {
        var title = document.createElement("strong");
        title.className = "chat-answer-title";
        title.textContent = meta.title;
        bubble.appendChild(title);
      }
      var body = document.createElement("div");
      body.className = "chat-answer-body";
      body.innerHTML = formatAnswer(text || "");
      bubble.appendChild(body);
    } else {
      var bodyPlain = document.createElement("div");
      bodyPlain.className = "chat-answer-body";
      bodyPlain.innerHTML = formatAnswer(text || "");
      bubble.appendChild(bodyPlain);
    }

    wrap.appendChild(bubble);

    if (role === "bot" && meta.sourceUrl) {
      var foot = document.createElement("div");
      foot.className = "chat-answer-foot";
      var link = document.createElement("a");
      link.href = meta.sourceUrl;
      link.className = "btn btn-gold btn-sm chat-source-btn";
      link.textContent = "← المصدر في الأرشيف";
      foot.appendChild(link);
      if (meta.libraryUrl) {
        var lib = document.createElement("a");
        lib.href = meta.libraryUrl;
        lib.className = "btn btn-outline btn-sm chat-source-btn";
        lib.style.marginRight = "0.5rem";
        lib.textContent = "المكتبة";
        foot.insertBefore(lib, link);
      }
      wrap.appendChild(foot);
    }

    if (meta.sources && meta.sources.length) {
      var src = document.createElement("div");
      src.className = "chat-sources";
      var srcLabel = document.createElement("span");
      srcLabel.textContent = "مصادر: ";
      src.appendChild(srcLabel);
      meta.sources.forEach(function (h) {
        var label = h.type === "article" ? "مقال" : h.type === "video" ? "فيديو" : "مقطع";
        if (h.url) {
          var a = document.createElement("a");
          a.href = h.url;
          a.className = "chat-source-tag chat-source-link";
          a.textContent = label + ": " + h.title;
          src.appendChild(a);
        } else {
          var tag = document.createElement("span");
          tag.className = "chat-source-tag";
          tag.textContent = label + ": " + h.title;
          src.appendChild(tag);
        }
      });
      wrap.appendChild(src);
    }

    if (role === "bot" && meta.showFeedback) {
      attachFeedbackBar(wrap, meta);
    }

    messages.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function attachFeedbackBar(wrap, meta) {
    var bar = document.createElement("div");
    bar.className = "chat-feedback-bar";
    bar.innerHTML = '<span class="chat-feedback-label">هل أفادك الرد؟</span>';
    var yes = document.createElement("button");
    yes.type = "button";
    yes.className = "chat-feedback-btn";
    yes.textContent = "نعم";
    var no = document.createElement("button");
    no.type = "button";
    no.className = "chat-feedback-btn chat-feedback-no";
    no.textContent = "لا";
    bar.appendChild(yes);
    bar.appendChild(no);
    var thanks = document.createElement("span");
    thanks.className = "chat-feedback-thanks";
    thanks.hidden = true;
    thanks.textContent = "شكراً — يُحفظ لتحسين الأرشيف.";
    bar.appendChild(thanks);

    function send(helpful) {
      if (feedbackSent) return;
      fetch("/api/cadres/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          question: lastQuestion,
          helpful: helpful ? 1 : 0,
          slug: meta.feedbackSlug || "",
          answerMode: meta.feedbackMode || "",
        }),
      }).catch(function () {});
      feedbackSent = true;
      yes.disabled = true;
      no.disabled = true;
      thanks.hidden = false;
    }
    yes.addEventListener("click", function () {
      send(true);
    });
    no.addEventListener("click", function () {
      send(false);
    });
    wrap.appendChild(bar);
  }

  function setLoading(on) {
    sendBtn.disabled = on;
    input.disabled = on;
  }

  function rememberSlug(slug) {
    if (!slug || seenSlugs.indexOf(slug) >= 0) return;
    seenSlugs.push(slug);
    if (seenSlugs.length > 40) seenSlugs.shift();
  }

  function showBotReply(data) {
    var text = data.answer || "لم أجد رداً في الأرشيف. جرّب سؤالاً من المقترحات.";
    if (data.slug) rememberSlug(data.slug);
    lastFeedbackMeta = {
      slug: data.slug || "",
      answerMode: data.feedbackMode || (data.llm ? "llm" : data.rag ? "rag" : "knowledge"),
    };
    feedbackSent = false;
    addMessage(text, "bot", {
      rag: data.rag,
      llm: data.llm,
      confidence: data.confidence,
      confidenceLabel: data.confidenceLabel,
      title: data.title,
      stage: data.stage,
      sourceUrl: data.sourceUrl,
      libraryUrl: data.libraryUrl,
      sources: data.sources,
      showFeedback: true,
      feedbackSlug: lastFeedbackMeta.slug,
      feedbackMode: lastFeedbackMeta.answerMode,
    });
    updateSuggestionBar(data.followUps);
  }

  async function sendQuestion(q) {
    var question = (q || input.value).trim();
    if (!question) return;

    addMessage(question, "user");
    input.value = "";

    lastQuestion = question;
    feedbackSent = false;

    var typing = document.createElement("div");
    typing.className = "chat-msg chat-msg-bot chat-typing";
    typing.innerHTML =
      '<div class="chat-bubble">جاري البحث في أرشيف الوعي' +
      (window.__cadresLlmHint ? " (قد يستغرق التوليد لحظات)" : "") +
      "…</div>";
    messages.appendChild(typing);
    scrollBottom();
    setLoading(true);

    try {
      var res = await fetch("/api/cadres/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ question: question, excludeSlugs: seenSlugs }),
      });
      var data;
      try {
        data = await res.json();
      } catch (parseErr) {
        typing.remove();
        addMessage("رد غير متوقع من الخادم — أعد تحميل الصفحة.", "bot");
        return;
      }
      typing.remove();

      if (res.status === 404) {
        addMessage(
          "واجهة المساعد غير موجودة على هذا المنفذ. شغّل: npm start ثم http://127.0.0.1:3000/cadres",
          "bot"
        );
        return;
      }
      if (res.status === 401 && data.loginUrl) {
        window.location.href = data.loginUrl;
        return;
      }
      if (res.status === 403 && data.verifyUrl) {
        window.location.href = data.verifyUrl;
        return;
      }
      if (!res.ok || !data.ok) {
        addMessage(data.error || "تعذّر الاتصال بالمساعد.", "bot");
        return;
      }

      showBotReply(data);
    } catch (e) {
      typing.remove();
      addMessage("خطأ في الشبكة — تأكد أن الخادم يعمل.", "bot");
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendQuestion();
  });

  bindAllChips(suggestions);

  fetch("/api/health", { headers: { Accept: "application/json" } })
    .then(function (r) {
      return r.json();
    })
    .then(function (h) {
      if (!h || !h.ok) throw new Error("bad");
      if (h.llm && h.llm.enabled) window.__cadresLlmHint = true;
    })
    .catch(function () {
      var warn = document.createElement("div");
      warn.className = "chat-msg chat-msg-bot";
      warn.innerHTML =
        '<div class="chat-bubble" style="border-color:#c44">' +
        "⚠ الخادم غير متصل أو تعمل نسخة قديمة. من مجلد المشروع شغّل: <strong>npm start</strong> أو <strong>start.bat</strong> " +
        "ثم افتح <strong>http://127.0.0.1:3000/cadres</strong> (وليس منفذ 5000 إلا بعد تشغيل Flask مع Node)." +
        "</div>";
      messages.insertBefore(warn, messages.firstChild);
    });
})();
