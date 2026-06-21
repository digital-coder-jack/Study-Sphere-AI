"""
=====================================================================
 STUDY SPHERE AI  -  backend/ai.py
=====================================================================
High-level AI study features built on top of groq_client.

Shared by BOTH the web app and the Telegram bot:
  * answer_question()  -> the bot's "library first, AI fallback" logic.

Web-only study tools (each returns clean text / structured data):
  * generate_notes()
  * generate_quiz()
  * generate_flashcards()
  * generate_study_plan()
  * summarize_text()
  * homework_help()

System prompts keep responses student-friendly and well-formatted in
Markdown so the frontend can render them nicely.
=====================================================================
"""

from __future__ import annotations

import json
import re

from backend import database as db
from backend import providers
from backend.groq_client import groq_chat, groq_chat_stream

SYSTEM_BASE = (
    "You are Study Sphere AI, a friendly and knowledgeable study assistant for "
    "students. Explain clearly, use simple language, and format answers in clean "
    "Markdown with headings, bullet points and code blocks where helpful."
)


# ---------------------------------------------------------------------------
# Shared bot logic: library first, AI fallback
# ---------------------------------------------------------------------------
async def answer_question(user_id: int, question: str) -> tuple[str, str]:
    """
    Return (source, answer) where source is 'library' or 'ai'.
    Mirrors the original Telegram bot behaviour exactly.
    """
    saved = db.db_find_answer(user_id, question)
    if saved:
        return "library", saved
    answer = await groq_chat(
        [
            {"role": "system", "content":
                "You are Study Sphere, a friendly study assistant. Answer clearly "
                "and concisely for students. Keep answers under 300 words."},
            {"role": "user", "content": question},
        ],
        temperature=0.7,
        max_tokens=512,
    )
    return "ai", answer


# ---------------------------------------------------------------------------
# Chat streaming (used by the web chat interface)
# ---------------------------------------------------------------------------
async def chat_stream(history: list[dict], selection: str | None = "auto"):
    """
    history is a list of {role, content}. We prepend the system prompt and
    stream the assistant reply through the multi-provider layer.

    Yields (event, value) tuples:
        ("meta",  provider_name)   the provider that handled the stream
        ("token", text_chunk)      incremental content
        ("error", message)         if every provider failed
    """
    messages = [{"role": "system", "content": SYSTEM_BASE}] + history
    async for event, value in providers.chat_stream(
        messages, selection=selection, temperature=0.7, max_tokens=1500
    ):
        yield event, value


# ---------------------------------------------------------------------------
# Study tools
# ---------------------------------------------------------------------------
async def generate_notes(topic: str, selection: str | None = "auto") -> str:
    return await groq_chat(
        [
            {"role": "system", "content": SYSTEM_BASE},
            {"role": "user", "content":
                f"Create concise, well-structured study notes on: {topic}.\n"
                f"Use Markdown with a title, key concepts as bullet points, "
                f"important definitions, and a short summary at the end."},
        ],
        temperature=0.5,
        max_tokens=1500,
        selection=selection,
    )


async def generate_study_plan(goal: str, days: int = 7, selection: str | None = "auto") -> str:
    return await groq_chat(
        [
            {"role": "system", "content": SYSTEM_BASE},
            {"role": "user", "content":
                f"Create a {days}-day study plan to achieve this goal: {goal}.\n"
                f"Format as a Markdown table or day-by-day list with specific "
                f"daily tasks, time estimates, and milestones."},
        ],
        temperature=0.5,
        max_tokens=1500,
        selection=selection,
    )


async def summarize_text(text: str, selection: str | None = "auto") -> str:
    snippet = text[:12000]  # protect token limits
    return await groq_chat(
        [
            {"role": "system", "content": SYSTEM_BASE},
            {"role": "user", "content":
                "Summarise the following document for a student. Provide a short "
                "overview, the key points as bullets, and any important terms.\n\n"
                f"{snippet}"},
        ],
        temperature=0.4,
        max_tokens=1200,
        selection=selection,
    )


async def homework_help(question: str, selection: str | None = "auto") -> str:
    return await groq_chat(
        [
            {"role": "system", "content":
                SYSTEM_BASE + " For homework, explain the reasoning step by step "
                "so the student learns, then give the final answer."},
            {"role": "user", "content": question},
        ],
        temperature=0.4,
        max_tokens=1500,
        selection=selection,
    )


def _extract_json(raw: str):
    """Best-effort extraction of a JSON array/object from an LLM reply."""
    raw = raw.strip()
    # Strip code fences if present.
    fence = re.search(r"```(?:json)?\s*(.*?)```", raw, re.DOTALL)
    if fence:
        raw = fence.group(1).strip()
    # Find the first [...] or {...} block.
    match = re.search(r"(\[.*\]|\{.*\})", raw, re.DOTALL)
    if match:
        raw = match.group(1)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def generate_quiz(topic: str, num_questions: int = 5, selection: str | None = "auto") -> list[dict]:
    """
    Return a list of {question, options:[...], answer:index} dicts.
    Falls back to an empty list if parsing fails.
    """
    reply = await groq_chat(
        [
            {"role": "system", "content":
                "You are a quiz generator. Respond ONLY with valid JSON, no prose."},
            {"role": "user", "content":
                f"Generate {num_questions} multiple-choice questions about '{topic}'. "
                f"Return a JSON array where each item has: "
                f'"question" (string), "options" (array of 4 strings), '
                f'"answer" (integer index 0-3 of the correct option), '
                f'and "explanation" (short string). Output ONLY the JSON array.'},
        ],
        temperature=0.6,
        max_tokens=2000,
        selection=selection,
    )
    data = _extract_json(reply)
    if not isinstance(data, list):
        return []
    cleaned = []
    for item in data:
        if (isinstance(item, dict) and "question" in item
                and isinstance(item.get("options"), list)):
            cleaned.append({
                "question": str(item.get("question", "")),
                "options": [str(o) for o in item["options"]][:4],
                "answer": int(item.get("answer", 0)) if str(item.get("answer", 0)).isdigit() else 0,
                "explanation": str(item.get("explanation", "")),
            })
    return cleaned


async def generate_flashcards(topic: str, num_cards: int = 8, selection: str | None = "auto") -> list[dict]:
    """Return a list of {front, back} flashcards."""
    reply = await groq_chat(
        [
            {"role": "system", "content":
                "You are a flashcard generator. Respond ONLY with valid JSON, no prose."},
            {"role": "user", "content":
                f"Generate {num_cards} study flashcards about '{topic}'. "
                f'Return a JSON array where each item has "front" (a question or term) '
                f'and "back" (the answer or definition). Output ONLY the JSON array.'},
        ],
        temperature=0.6,
        max_tokens=2000,
        selection=selection,
    )
    data = _extract_json(reply)
    if not isinstance(data, list):
        return []
    return [
        {"front": str(it.get("front", "")), "back": str(it.get("back", ""))}
        for it in data if isinstance(it, dict) and "front" in it
    ]
