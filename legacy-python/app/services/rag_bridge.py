"""جسر المساعد — يستدعي محرك Node (نفس منطق server.js) أو يعود لبحث CSV بسيط."""

import csv
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "data" / "rag_qa_mapping.csv"
NODE_CLI = ROOT / "scripts" / "rag-chat-cli.js"

STOP = {
    "ما", "هل", "من", "في", "عن", "على", "ان", "لا", "لي", "كيف", "متى", "اين",
    "لماذا", "ماذا", "ايه", "يا", "انا", "انت", "هو", "هي", "اريد", "عايز",
}


def _normalize(text: str) -> str:
    t = (text or "").lower()
    t = re.sub(r"[\u064b-\u065f\u0670]", "", t)
    t = re.sub(r"[أإآٱ]", "ا", t)
    t = re.sub(r"ى", "ي", t)
    t = re.sub(r"ة", "ه", t)
    t = re.sub(r"[^\w\u0600-\u06FF\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _tokenize(query: str) -> list[str]:
    words = []
    for w in _normalize(query).split():
        s = w
        for p in ("وال", "وب", "ال", "و", "ب"):
            if s.startswith(p) and len(s) > len(p) + 1:
                s = s[len(p) :]
                break
        if len(s) >= 2 and s not in STOP:
            words.append(s)
    return words


def _load_rows() -> list[dict]:
    if not CSV_PATH.exists():
        return []
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _search_python(query: str) -> dict | None:
    tokens = _tokenize(query)
    if not tokens:
        return None
    best, best_score = None, 0
    for row in _load_rows():
        hay = " ".join(
            [
                row.get("user_question", ""),
                row.get("title", ""),
                (row.get("tags") or "").replace(";", " "),
            ]
        )
        norm = _normalize(hay)
        score = sum(3 for t in tokens if t in norm) * 1
        if score > best_score:
            best_score, best = score, row
    if not best or best_score < 3:
        return None
    slug = best.get("slug", "")
    return {
        "ok": True,
        "answer": best.get("optimized_answer", ""),
        "sources": [],
        "hasResults": True,
        "rag": True,
        "title": best.get("title"),
        "stage": best.get("stage"),
        "slug": slug,
        "sourceUrl": f"/waei/source/{slug}" if slug else None,
        "libraryUrl": None,
        "followUps": {"related": None, "unrelated": None},
    }


def chat_via_node(question: str, exclude_slugs: list | None = None) -> dict | None:
    if not NODE_CLI.exists():
        return None
    try:
        proc = subprocess.run(
            ["node", str(NODE_CLI), question, json.dumps(exclude_slugs or [], ensure_ascii=False)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=12,
        )
        if proc.returncode != 0:
            return None
        return json.loads(proc.stdout.strip())
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError, OSError):
        return None


def build_chat_response(question: str, exclude_slugs: list | None = None) -> dict:
    data = chat_via_node(question, exclude_slugs)
    if data and data.get("ok"):
        return data
    py = _search_python(question)
    if py:
        return py
    return {
        "ok": True,
        "answer": "لم أجد في أرشيف الوعي مرجعاً مباشراً. جرّب سؤالاً من الاقتراحات أو صِغ كلمات أوضح.",
        "sources": [],
        "hasResults": False,
        "rag": False,
        "followUps": {"related": None, "unrelated": None},
    }


def get_row_by_slug(slug: str) -> dict | None:
    for row in _load_rows():
        if row.get("slug") == slug:
            return row
    return None
