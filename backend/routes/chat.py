"""
=====================================================================
 STUDY SPHERE AI  -  backend/routes/chat.py
=====================================================================
AI chat interface + study tools + dashboard statistics.

Chat:
  GET    /api/chats                 -> list user's chats
  POST   /api/chats                 -> create a new chat
  GET    /api/chats/{id}            -> chat with all messages
  PUT    /api/chats/{id}            -> rename chat
  DELETE /api/chats/{id}            -> delete chat
  POST   /api/chats/{id}/stream     -> send a message, stream AI reply (SSE)

Dashboard:
  GET    /api/stats                 -> usage statistics for the dashboard

Study tools:
  POST   /api/tools/notes           -> generate + save notes
  GET    /api/tools/notes           -> list saved notes
  DELETE /api/tools/notes/{id}      -> delete a note
  POST   /api/tools/quiz            -> generate + save a quiz
  GET    /api/tools/quiz            -> list saved quizzes
  DELETE /api/tools/quiz/{id}       -> delete a quiz
  POST   /api/tools/flashcards      -> generate flashcards
  POST   /api/tools/plan            -> generate study plan
  POST   /api/tools/summarize       -> summarise pasted text
  POST   /api/tools/homework        -> homework helper
=====================================================================
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend import ai, auth, database as db

router = APIRouter(prefix="/api", tags=["chat"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class NewChatIn(BaseModel):
    title: str | None = None


class RenameChatIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class StreamIn(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class TopicIn(BaseModel):
    topic: str = Field(min_length=1, max_length=300)


class QuizIn(BaseModel):
    topic: str = Field(min_length=1, max_length=300)
    num_questions: int = Field(default=5, ge=1, le=15)


class FlashIn(BaseModel):
    topic: str = Field(min_length=1, max_length=300)
    num_cards: int = Field(default=8, ge=1, le=20)


class PlanIn(BaseModel):
    goal: str = Field(min_length=1, max_length=300)
    days: int = Field(default=7, ge=1, le=60)


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class QuestionIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


# ===========================================================================
# CHATS
# ===========================================================================
@router.get("/chats")
async def get_chats(user=Depends(auth.current_user)):
    rows = db.list_chats(user["id"])
    return {"chats": [dict(r) for r in rows]}


@router.post("/chats")
async def new_chat(body: NewChatIn, user=Depends(auth.current_user)):
    title = (body.title or "New Chat").strip()[:120] or "New Chat"
    chat_id = db.create_chat(user["id"], title)
    return {"chat": dict(db.get_chat(user["id"], chat_id))}


@router.get("/chats/{chat_id}")
async def get_one_chat(chat_id: int, user=Depends(auth.current_user)):
    chat = db.get_chat(user["id"], chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    messages = db.list_messages(chat_id)
    return {"chat": dict(chat), "messages": [dict(m) for m in messages]}


@router.put("/chats/{chat_id}")
async def rename(chat_id: int, body: RenameChatIn, user=Depends(auth.current_user)):
    if not db.rename_chat(user["id"], chat_id, body.title):
        raise HTTPException(status_code=404, detail="Chat not found.")
    return {"chat": dict(db.get_chat(user["id"], chat_id))}


@router.delete("/chats/{chat_id}")
async def remove_chat(chat_id: int, user=Depends(auth.current_user)):
    if not db.delete_chat(user["id"], chat_id):
        raise HTTPException(status_code=404, detail="Chat not found.")
    return {"deleted": True}


@router.post("/chats/{chat_id}/stream")
async def stream_message(chat_id: int, body: StreamIn, user=Depends(auth.current_user)):
    """
    Save the user message, then stream the assistant reply as Server-Sent
    Events. Each SSE 'data:' line carries a JSON object:
        {"token": "..."}   incremental text
        {"done": true, "message_id": N}  end of stream
    """
    chat = db.get_chat(user["id"], chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")

    # Persist the user's message.
    db.add_message(chat_id, "user", body.content)

    # Auto-title the chat from the first user message.
    history_rows = db.list_messages(chat_id)
    if len([m for m in history_rows if m["role"] == "user"]) == 1:
        auto_title = body.content.strip().replace("\n", " ")[:48]
        db.rename_chat(user["id"], chat_id, auto_title or "New Chat")

    history = [{"role": m["role"], "content": m["content"]} for m in history_rows]

    async def event_generator():
        collected = []
        try:
            async for token in ai.chat_stream(history):
                collected.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception:
            yield f"data: {json.dumps({'token': ' [stream interrupted]'})}\n\n"
        finally:
            full = "".join(collected).strip() or "⚠️ No response was generated."
            msg_id = db.add_message(chat_id, "assistant", full)
            yield f"data: {json.dumps({'done': True, 'message_id': msg_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===========================================================================
# DASHBOARD STATS
# ===========================================================================
@router.get("/stats")
async def stats(user=Depends(auth.current_user)):
    uid = user["id"]
    chats = db.list_chats(uid)
    return {
        "total_chats": len(chats),
        "total_messages": db.count_messages(uid),
        "ai_responses": db.count_ai_messages(uid),
        "notes": db.count_notes(uid),
        "quizzes": db.count_quizzes(uid),
        "recent_chats": [dict(c) for c in chats[:5]],
        "daily_activity": db.daily_activity(uid, days=7),
    }


# ===========================================================================
# STUDY TOOLS
# ===========================================================================
@router.post("/tools/notes")
async def make_notes(body: TopicIn, user=Depends(auth.current_user)):
    content = await ai.generate_notes(body.topic)
    note_id = db.add_note(user["id"], body.topic, content)
    return {"id": note_id, "topic": body.topic, "content": content}


@router.get("/tools/notes")
async def get_notes(user=Depends(auth.current_user)):
    return {"notes": [dict(n) for n in db.list_notes(user["id"])]}


@router.delete("/tools/notes/{note_id}")
async def remove_note(note_id: int, user=Depends(auth.current_user)):
    if not db.delete_note(user["id"], note_id):
        raise HTTPException(status_code=404, detail="Note not found.")
    return {"deleted": True}


@router.post("/tools/quiz")
async def make_quiz(body: QuizIn, user=Depends(auth.current_user)):
    questions = await ai.generate_quiz(body.topic, body.num_questions)
    if not questions:
        raise HTTPException(status_code=502, detail="Could not generate a quiz. Try a clearer topic.")
    quiz_id = db.add_quiz(user["id"], body.topic, questions)
    return {"id": quiz_id, "topic": body.topic, "questions": questions}


@router.get("/tools/quiz")
async def get_quizzes(user=Depends(auth.current_user)):
    return {"quizzes": db.list_quizzes(user["id"])}


@router.delete("/tools/quiz/{quiz_id}")
async def remove_quiz(quiz_id: int, user=Depends(auth.current_user)):
    if not db.delete_quiz(user["id"], quiz_id):
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return {"deleted": True}


@router.post("/tools/flashcards")
async def make_flashcards(body: FlashIn, user=Depends(auth.current_user)):
    cards = await ai.generate_flashcards(body.topic, body.num_cards)
    if not cards:
        raise HTTPException(status_code=502, detail="Could not generate flashcards. Try a clearer topic.")
    return {"topic": body.topic, "cards": cards}


@router.post("/tools/plan")
async def make_plan(body: PlanIn, user=Depends(auth.current_user)):
    content = await ai.generate_study_plan(body.goal, body.days)
    return {"goal": body.goal, "days": body.days, "content": content}


@router.post("/tools/summarize")
async def summarize(body: TextIn, user=Depends(auth.current_user)):
    content = await ai.summarize_text(body.text)
    return {"summary": content}


@router.post("/tools/homework")
async def homework(body: QuestionIn, user=Depends(auth.current_user)):
    content = await ai.homework_help(body.question)
    return {"answer": content}


@router.post("/tools/mindmap")
async def make_mindmap(body: TopicIn, user=Depends(auth.current_user)):
    data = await ai.generate_mindmap(body.topic)
    return {"topic": body.topic, "mindmap": data}
