const XLSX = require("xlsx");

/** أعمدة ورقة الفيديوهات — تطابق جدول videos */
const VIDEO_HEADERS = [
  "العنوان",
  "slug_التصنيف",
  "الوصف",
  "رابط_يوتيوب",
  "المدة_ثواني",
  "ترتيب",
  "النص_الكامل",
  "نشر",
];
const VIDEO_DB_ROW = [
  "title",
  "→ category_id",
  "description",
  "youtube_url",
  "duration_seconds",
  "sort_order",
  "transcript_text",
  "is_published",
];

/** أعمدة ورقة المقاطع — تطابق video_transcript_segments */
const SEG_HEADERS = ["عنوان_الفيديو", "من_ثانية", "إلى_ثانية", "النص"];
const SEG_DB_ROW = ["→ video_id", "start_seconds", "end_seconds", "text"];

const VIDEO_MAP = {
  العنوان: "title",
  title: "title",
  slug_التصنيف: "category_slug",
  category_slug: "category_slug",
  الوصف: "description",
  description: "description",
  رابط_يوتيوب: "youtube_url",
  youtube_url: "youtube_url",
  المدة_ثواني: "duration_seconds",
  duration_seconds: "duration_seconds",
  ترتيب: "sort_order",
  sort_order: "sort_order",
  النص_الكامل: "transcript_text",
  transcript_text: "transcript_text",
  نشر: "is_published",
  is_published: "is_published",
};

const SEG_MAP = {
  عنوان_الفيديو: "video_title",
  video_title: "video_title",
  من_ثانية: "start_seconds",
  start_seconds: "start_seconds",
  إلى_ثانية: "end_seconds",
  end_seconds: "end_seconds",
  النص: "text",
  text: "text",
};

const SAMPLE_VIDEOS = [
  [
    "خطورة السكر على الفطرة",
    "cut-toxins",
    "شرح علمي لأضرار السكر على الجسد والهرمونات",
    "",
    "600",
    "1",
    "السكر يدمر الخلايا. يجب قطع السكر تدريجياً خلال الأربعين يوماً.",
    "نعم",
  ],
  [
    "منهج الأربعين يوماً — البداية",
    "forty-days",
    "كيف تبدأ رحلة التطهير السيادي",
    "",
    "900",
    "2",
    "الأربعون يوماً ليست حمية — بل استرداد للسيادة على جسدك.",
    "نعم",
  ],
];

const SAMPLE_SEGS = [
  ["خطورة السكر على الفطرة", "0", "120", "السكر يدمر الخلايا ويُسبب الالتهاب المزمن."],
  ["خطورة السكر على الفطرة", "120", "300", "يجب قطع السكر تدريجياً خلال الأربعين يوماً."],
  ["خطورة السكر على الفطرة", "300", "600", "البدائل الطبيعية: التمر والعسل الخام باعتدال."],
];

/** قوالب جاهزة لموضوعات محددة — صفوف مثال قابلة للتعديل */
const TOPIC_PACKS = {
  "forty-days": {
    label: "الأربعين يوم",
    description: "منهج التطهير السيادي — المستوى 1 / تصنيف forty-days",
    videos: [
      [
        "معركة الأربعين يوم — إعلان السيادة على الجسد",
        "forty-days",
        "ما معنى الأربعين يوم ولماذا ليست حمية مؤقتة",
        "",
        "720",
        "1",
        "الأربعون يوماً ليست حمية سعرات ولا موضة. هي إعلان سيادة: تقطع كابلات السكر والدقيق والزيوت المهدرجة، وتصوم الشاشات لترميم الدوبامين، وتعود للطيبات. جسدك يستعيد إعدادات المصنع، وعقلك يكسر كود التبعية الكيميائية.",
        "نعم",
      ],
      [
        "خطة الأسبوع الأول — البداية العملية",
        "forty-days",
        "خطوات الأيام السبعة الأولى: ماذا تقطع وماذا تستبدل",
        "",
        "900",
        "2",
        "ابدأ بقطع المشروبات الغازية والعصائر المصنعة. استبدل زيت المطبخ المهدرج بالسمن الحيواني أو الزبدة الطبيعية. لا تشتري «دايت» — المحليات الصناعية خدعة. اشرب ماءً نقياً، نم مبكراً، وقلّل الشاشات بعد العشاء.",
        "نعم",
      ],
      [
        "ماذا بعد اليوم الأربعين — استمرار لا تراجع",
        "forty-days",
        "كيف تحافظ على المكاسب وتتدرج في الطيبات",
        "",
        "600",
        "3",
        "بعد الأربعين يوماً لا تعود لعلف المصانع. التدرج هو حكمة الخليفة: أدخل التمر والعسل الخام باعتدال، جرّب البقوليات منقوعة ومطهية، وابقَ على guard ضد «نقطة الهناء» في الأكل الجاهز.",
        "نعم",
      ],
    ],
    segments: [
      ["معركة الأربعين يوم — إعلان السيادة على الجسد", "0", "180", "الأربعون يوماً إعلان سيادة — ليست حمية مؤقتة."],
      ["معركة الأربعين يوم — إعلان السيادة على الجسد", "180", "420", "تقطع السكر والدقيق والزيوت المهدرجة وصيام الشاشات."],
      ["معركة الأربعين يوم — إعلان السيادة على الجسد", "420", "720", "جسدك يستعيد إعدادات المصنع وعقلك يتحرر من التبعية."],
      ["خطة الأسبوع الأول — البداية العملية", "0", "240", "أيام 1–3: قطع الغازيات والعصائر والمشروبات المحلّاة."],
      ["خطة الأسبوع الأول — البداية العملية", "240", "540", "أيام 4–5: استبدال الزيوت المهدرجة بالسمن والزبدة الطبيعية."],
      ["خطة الأسبوع الأول — البداية العملية", "540", "900", "أيام 6–7: نوم مبكر، ماء نقي، تقليل الشاشات ليلاً."],
      ["ماذا بعد اليوم الأربعين — استمرار لا تراجع", "0", "300", "لا تراجع لعلف المصانع — التدرج لا العودة للخبائث."],
      ["ماذا بعد اليوم الأربعين — استمرار لا تراجع", "300", "600", "التمر والعسل باعتدال، البقوليات منقوعة، حذر من نقطة الهناء."],
    ],
  },
  "cut-sugar": {
    label: "قطع السكر",
    description: "بروتوكول قطع السكر — المستوى 1 / تصنيف cut-toxins",
    videos: [
      [
        "خطورة السكر على الفطرة",
        "cut-toxins",
        "لماذا السكر المكرر كابل يربطك بالمنظومة",
        "",
        "600",
        "1",
        "السكر المكرر يرفع الأنسولين ثم ينهار فيطلب دماغك المزيد. يُسبب التهاباً مزمناً وضباباً ذهنياً. قطعه خلال الأربعين يوماً ليس حرماناً — بل فك كابل كيميائي.",
        "نعم",
      ],
      [
        "بروتوكول قطع السكر — خطوة بخطوة",
        "cut-toxins",
        "كيف تقطع تدريجياً دون انهيار",
        "",
        "780",
        "2",
        "لا تقطع كل شيء دفعة واحدة. ابدأ بالمشروبات المحلّاة، ثم الحلويات، ثم «الخبائث المخفية» في الصلصات والمعلبات. اشرب ماءً، نم جيداً، ولا تستبدل بمحليات صناعية.",
        "نعم",
      ],
      [
        "انسحاب السكر — لماذا الصداع وكيف تتجاوزه",
        "cut-toxins",
        "فهم انسحاب كيميائي وإدارة الأعراض",
        "",
        "540",
        "3",
        "الصداع ليس عقاباً — انسحاب كيميائي. السكر كان يضرب مركز المكافأة. عند القطع، خلاياك تتأقلم والتهاب ينخفض. الماء، الراحة، والثبات أهم من أي «حل سريع».",
        "نعم",
      ],
      [
        "بدائل طبيعية بعد التطهير",
        "cut-toxins",
        "التمر والعسل الخام — متى وكيف",
        "",
        "480",
        "4",
        "بعد انتهاء مرحلة التطهير فقط: التمر والعسل الخام باعتدال. ليسا «سكراً حراً» — بل طيبات بإيقاع فطري. لا تستبدل إدماناً بآخر.",
        "نعم",
      ],
    ],
    segments: [
      ["خطورة السكر على الفطرة", "0", "120", "السكر يدمر الخلايا ويُسبب التهاباً مزمناً."],
      ["خطورة السكر على الفطرة", "120", "300", "قطع السكر خلال الأربعين يوماً فك كابل كيميائي."],
      ["خطورة السكر على الفطرة", "300", "600", "البدائل بعد التطهير: التمر والعسل باعتدال."],
      ["بروتوكول قطع السكر — خطوة بخطوة", "0", "200", "المرحلة 1: قطع الغازيات والعصائر."],
      ["بروتوكول قطع السكر — خطوة بخطوة", "200", "450", "المرحلة 2: الحلويات والخبائث المخفية في المعلبات."],
      ["بروتوكول قطع السكر — خطوة بخطوة", "450", "780", "لا محليات «دايت» — تبقى على guard."],
      ["انسحاب السكر — لماذا الصداع وكيف تتجاوزه", "0", "270", "الصداع انسحاب كيميائي لا عقاب."],
      ["انسحاب السكر — لماذا الصداع وكيف تتجاوزه", "270", "540", "ماء، راحة، ثبات — الكابل انقطع."],
      ["بدائل طبيعية بعد التطهير", "0", "240", "التمر والعسل بعد التطهير فقط."],
      ["بدائل طبيعية بعد التطهير", "240", "480", "اعتدال لا إدماناً ببديل."],
    ],
  },
};

function parsePublished(val) {
  const s = String(val ?? "")
    .trim()
    .toLowerCase();
  if (!s) return 1;
  if (["نعم", "yes", "1", "true", "منشور"].includes(s)) return 1;
  if (["لا", "no", "0", "false", "مسودة"].includes(s)) return 0;
  return 1;
}

function cell(v) {
  if (v == null) return "";
  return String(v).trim();
}

function mapRow(rawRow, headerMap) {
  const mapped = {};
  Object.entries(rawRow).forEach(([k, v]) => {
    const key = headerMap[String(k).trim()];
    if (key) mapped[key] = v;
  });
  return mapped;
}

function findSheet(names, patterns) {
  for (const p of patterns) {
    const hit = names.find((n) => p.test(n));
    if (hit) return hit;
  }
  return null;
}

function decorateDataSheet(ws, headerCount) {
  if (!ws["!ref"]) return ws;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: range.e.r, c: Math.min(range.e.c, headerCount - 1) },
    }),
  };
  ws["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  return ws;
}

function buildInstructionsSheet() {
  return [
    ["قالب استيراد مكتبة الوعي — شفرة الفطرة"],
    [""],
    ["الأوراق الثلاث للبيانات (لا تحذف صف العناوين):"],
    ["1) videos — جدول الفيديوهات (videos)"],
    ["2) video_transcript_segments — مقاطع النص الزمنية"],
    ["3) library_categories — مرجع التصنيفات (للقراءة فقط؛ slug من هنا)"],
    [""],
    ["جدول videos — الصف الأول عربي، الصف الثاني أسماء الحقول في SQLite:"],
    VIDEO_HEADERS,
    VIDEO_DB_ROW,
    [""],
    ["جدول video_transcript_segments:"],
    SEG_HEADERS,
    SEG_DB_ROW,
    [""],
    ["ملاحظات:"],
    ["• slug_التصنيف يجب أن يطابق عمود slug في library_categories."],
    ["• عنوان_الفيديو في المقاطع = نفس العنوان في ورقة videos (حرفياً)."],
    ["• نشر: نعم / لا — يتحول إلى is_published (1 أو 0)."],
    ["• إن وُجد النص_الكامل دون مقاطع، يُنشأ مقطع واحد 0 → المدة."],
    ["• ملف الفيديو المحلي يُرفع لاحقاً من لوحة الإدارة."],
  ];
}

function buildCategoriesSheet(categories) {
  const header = ["id", "slug", "name_ar", "level_id", "level_name", "ملاحظة"];
  const rows = (categories || []).map((c) => [
    c.id ?? "",
    c.slug,
    c.name_ar,
    c.level_id ?? "",
    c.level_name || "",
    "استخدم slug في عمود slug_التصنيف",
  ]);
  return [header, ...rows];
}

function buildWorkbookBuffer(categories, videos, segments, topicNote) {
  const wb = XLSX.utils.book_new();

  const instructions = buildInstructionsSheet();
  if (topicNote) {
    instructions.splice(1, 0, [`موضوع القالب: ${topicNote}`], [""]);
  }
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst["!cols"] = [{ wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "تعليمات");

  const videoAoa = [VIDEO_HEADERS, VIDEO_DB_ROW, ...videos];
  const wsVideos = decorateDataSheet(XLSX.utils.aoa_to_sheet(videoAoa), VIDEO_HEADERS.length);
  wsVideos["!cols"] = [
    { wch: 32 },
    { wch: 16 },
    { wch: 36 },
    { wch: 28 },
    { wch: 12 },
    { wch: 8 },
    { wch: 44 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, wsVideos, "videos");

  const segAoa = [SEG_HEADERS, SEG_DB_ROW, ...segments];
  const wsSegs = decorateDataSheet(XLSX.utils.aoa_to_sheet(segAoa), SEG_HEADERS.length);
  wsSegs["!cols"] = [{ wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsSegs, "video_transcript_segments");

  const catAoa = buildCategoriesSheet(categories);
  const wsCats = decorateDataSheet(XLSX.utils.aoa_to_sheet(catAoa), 6);
  wsCats["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 26 }, { wch: 10 }, { wch: 22 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsCats, "library_categories");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function buildTemplateBuffer(categories) {
  return buildWorkbookBuffer(categories, SAMPLE_VIDEOS, SAMPLE_SEGS, null);
}

function buildTopicTemplateBuffer(topicKey, categories) {
  const pack = TOPIC_PACKS[topicKey];
  if (!pack) return null;
  const note = `${pack.label} — ${pack.description}`;
  return buildWorkbookBuffer(categories, pack.videos, pack.segments, note);
}

function listTopicPacks() {
  return Object.entries(TOPIC_PACKS).map(([key, pack]) => ({
    key,
    label: pack.label,
    description: pack.description,
    videoCount: pack.videos.length,
    segmentCount: pack.segments.length,
  }));
}

function isDbHintRow(mapped) {
  const title = cell(mapped.title);
  if (title === "title" || title === "→ category_id") return true;
  return Object.values(mapped).some((v) => cell(v) === "→ category_id" || cell(v) === "→ video_id");
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const videoSheet =
    findSheet(wb.SheetNames, [/^videos$/i, /فيديو/i]) || wb.SheetNames.find((n) => n !== "تعليمات");
  const segSheet = findSheet(wb.SheetNames, [/^video_transcript_segments$/i, /مقاط/i, /segment/i]);

  if (!videoSheet) return { videos: [], segments: [], errors: ["لا توجد ورقة فيديوهات (videos)."] };

  const rawVideos = XLSX.utils.sheet_to_json(wb.Sheets[videoSheet], { defval: "", raw: false });
  const videos = [];
  const errors = [];

  rawVideos.forEach((raw, idx) => {
    const line = idx + 2;
    const m = mapRow(raw, VIDEO_MAP);
    if (isDbHintRow(m)) return;
    const title = cell(m.title);
    const slug = cell(m.category_slug);
    if (!title && !slug) return;
    if (!title || !slug) {
      errors.push(`فيديو صف ${line}: العنوان و slug_التصنيف مطلوبان.`);
      return;
    }
    videos.push({
      title,
      category_slug: slug,
      description: cell(m.description),
      youtube_url: cell(m.youtube_url),
      duration_seconds: parseInt(m.duration_seconds, 10) || 0,
      sort_order: parseInt(m.sort_order, 10) || 0,
      transcript_text: cell(m.transcript_text),
      is_published: parsePublished(m.is_published),
    });
  });

  const segments = [];
  if (segSheet) {
    const rawSegs = XLSX.utils.sheet_to_json(wb.Sheets[segSheet], { defval: "", raw: false });
    rawSegs.forEach((raw, idx) => {
      const line = idx + 2;
      const s = mapRow(raw, SEG_MAP);
      if (cell(s.video_title) === "→ video_id" || cell(s.video_title) === "video_title") return;
      const videoTitle = cell(s.video_title);
      const text = cell(s.text);
      if (!videoTitle && !text) return;
      if (!videoTitle || !text) {
        errors.push(`مقطع صف ${line}: عنوان_الفيديو والنص مطلوبان.`);
        return;
      }
      segments.push({
        video_title: videoTitle,
        start_seconds: parseFloat(s.start_seconds) || 0,
        end_seconds: parseFloat(s.end_seconds) || 0,
        text,
      });
    });
  }

  if (!videos.length && !errors.length) errors.push("لم تُعثر على فيديوهات صالحة في ورقة videos.");
  return { videos, segments, errors };
}

function importLibrary(db, videos, segments) {
  const catBySlug = {};
  db.prepare(`SELECT c.slug, c.id FROM library_categories c`)
    .all()
    .forEach((r) => {
      catBySlug[r.slug] = r.id;
    });

  const now = new Date().toISOString();
  const insVid = db.prepare(
    `INSERT INTO videos (category_id, title, description, youtube_url, duration_seconds, sort_order, transcript_text, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insSeg = db.prepare(
    `INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text) VALUES (?, ?, ?, ?)`
  );

  const titleToId = {};
  let imported = 0;
  const importErrors = [];

  const run = db.transaction(() => {
    videos.forEach((v) => {
      const catId = catBySlug[v.category_slug];
      if (!catId) {
        importErrors.push(`تصنيف غير موجود: ${v.category_slug}`);
        return;
      }
      const r = insVid.run(
        catId,
        v.title,
        v.description,
        v.youtube_url || null,
        v.duration_seconds,
        v.sort_order || 0,
        v.transcript_text,
        v.is_published,
        now,
        now
      );
      titleToId[v.title] = r.lastInsertRowid;
      imported += 1;

      if (v.transcript_text && !segments.some((s) => s.video_title === v.title)) {
        insSeg.run(r.lastInsertRowid, 0, v.duration_seconds || 60, v.transcript_text);
      }
    });

    segments.forEach((s) => {
      const vid = titleToId[s.video_title];
      if (!vid) {
        importErrors.push(`فيديو غير موجود للمقطع: ${s.video_title}`);
        return;
      }
      insSeg.run(vid, s.start_seconds, s.end_seconds || s.start_seconds + 30, s.text);
    });
  });
  run();

  return { imported, errors: importErrors };
}

module.exports = {
  buildTemplateBuffer,
  buildTopicTemplateBuffer,
  listTopicPacks,
  TOPIC_PACKS,
  parseWorkbook,
  importLibrary,
  VIDEO_HEADERS,
  SEG_HEADERS,
};
