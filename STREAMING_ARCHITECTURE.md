# Reliable Chat Streaming Architecture (ChatGPT/Gemini-style)

This document describes the streaming chat subsystem of **Study Sphere AI** and
the guarantees it provides. It maps each requirement to concrete code.

| File | Role |
|------|------|
| `backend/stream_manager.py` | Control plane: one active stream per session, safe cancellation |
| `backend/providers.py`      | Multi-provider streaming with fallback, timeouts, structured errors |
| `backend/ai.py`             | System prompt + thin pass-through to providers |
| `backend/routes/chat.py`    | SSE endpoint, placeholder/finalize message lifecycle, `/cancel` |
| `backend/database.py`       | `add_message`, `update_message`, `delete_message`, history |
| `frontend/js/chat.js`       | `AbortController`, supersede-previous, stop button, latest-message updates |
| `frontend/js/app.js`        | `SS.api()` now forwards an `AbortSignal` |

---

## 1. Architecture Design

```
                          ┌──────────────────────────────────────────┐
   Browser (chat.js)      │                Backend (FastAPI)          │
 ┌───────────────────┐    │                                           │
 │ AbortController    │    │  POST /api/chats/{id}/stream              │
 │ activeBody (latest)│ ── │  POST /api/chats/{id}/cancel              │
 │ streaming flag     │    │                                           │
 └─────────┬─────────┘    │   ┌──────────────────────────────────┐    │
           │ fetch (SSE)  │   │        StreamManager             │    │
           ▼              │   │  key = u{user}:c{chat}           │    │
  reads data: frames ◄────┼───┤  per-key asyncio.Lock            │    │
  updates ONLY the        │   │  generation counter (supersede)  │    │
  latest assistant bubble │   │  cancel_event (cooperative)      │    │
                          │   │  message_id (latest assistant)   │    │
                          │   └───────────────┬──────────────────┘    │
                          │                   │                       │
                          │           ai.chat_stream(cancel_event)    │
                          │                   │                       │
                          │        providers.chat_stream (fallback)   │
                          │        Kimi → Gemini → Groq               │
                          │        idle + total timeouts              │
                          │                   │                       │
                          │            SQLite messages table          │
                          │  user row + assistant placeholder→final   │
                          └──────────────────────────────────────────┘
```

**Key idea:** the *server* owns the "only one active stream" invariant via the
`StreamManager`. The client mirrors it for UX, but even a malicious/buggy client
(two tabs, two devices) cannot create two concurrent streams for the same chat:
`StreamManager.begin()` cancels the previous one atomically under a per-session
lock.

---

## 2. API Flow

### Endpoints
```
GET    /api/chats                 list sessions
POST   /api/chats                 create session (returns chatId)
GET    /api/chats/{id}            session + full message history
PUT    /api/chats/{id}            rename
DELETE /api/chats/{id}            delete
POST   /api/chats/{id}/stream     send message + stream reply (SSE)   ← core
POST   /api/chats/{id}/cancel     stop the active stream (idempotent) ← new
GET    /api/ai/models             list models + current selection
PUT    /api/ai/model              persist model selection (auto/kimi/gemini/groq)
```

### Lifecycle of one streamed reply
```
1. Client cancels any previous stream (AbortController.abort + POST /cancel).
2. Client POST /stream { content, model }.
3. Server: StreamManager.begin(key)
      → bumps generation, sets previous stream's cancel_event (supersede).
4. Server persists USER message; auto-titles chat on first message.
5. Server creates an EMPTY assistant placeholder row -> assistant_id.
      → attach_message(key, generation, assistant_id).
      → if already superseded, delete placeholder + emit "cancelled".
6. Server streams provider tokens, polling cancel_event between chunks.
7. On finish/cancel/error: update_message(assistant_id, fullText)  ← latest only.
8. StreamManager.finish(key, generation)  (no-op if superseded).
9. Server emits terminal frame ("done" | "cancelled" | "error").
```

---

## 3. Streaming Format (SSE)

Transport: `text/event-stream`, one JSON object per `data:` frame, frames
separated by a blank line. Headers disable proxy buffering
(`X-Accel-Buffering: no`, `Cache-Control: no-cache`).

```
data: {"event":"start","message_id":501,"generation":7}

data: {"event":"provider","provider":"kimi"}

data: {"event":"token","token":"Photo"}

data: {"event":"token","token":"synthesis"}

data: {"event":"done","message_id":501,"provider":"kimi"}
```

Terminal events (mutually exclusive):
- `{"event":"done","message_id":N,"provider":"..."}`
- `{"event":"cancelled","reason":"...","message_id":N}`
- `{"event":"error","error":{"type":"timeout|network|http|unavailable|not_configured","message":"..."}}`

---

## 4. Error Handling Strategy

| Failure | Detection | Behaviour |
|---------|-----------|-----------|
| No provider configured | `resolve_order()` empty | `error{type:"not_configured"}` before any token |
| Provider HTTP error before tokens | non-200 status | fall back to next provider |
| All providers fail | loop exhausts | `error{type:"unavailable"\|last error}` |
| Network error before tokens | `httpx.ConnectError/Timeout` | fall back to next provider |
| Network error mid-stream | exception after `produced` | inline `⚠️ connection interrupted`, keep partial, stop |
| Stalled upstream (no token for N s) | `asyncio.wait_for(idle_timeout)` | `⚠️ stalled` if produced, else fall back |
| Overall too slow | total time budget | `⚠️ timed out` if produced, else error |
| User stop / superseded | `cancel_event` set | stop promptly, `cancelled`, **keep partial text** |
| Client disconnect | generator `finally` | placeholder still finalized → no empty/dangling pair |

Client maps structured `error.type` to friendly sentences (`friendlyError()`),
and treats `AbortError` as an intentional stop (keeps any partial output).

Tunable via env vars: `AI_STREAM_TIMEOUT` (total, default 120s),
`AI_STREAM_IDLE_TIMEOUT` (per-token, default 30s).

---

## 5. Example Request/Response Flow

### Normal completion
```
POST /api/chats/42/stream
Authorization: Bearer <jwt>
Content-Type: application/json

{ "content": "Explain photosynthesis simply", "model": "auto" }

--- response: text/event-stream ---
data: {"event":"start","message_id":501,"generation":3}
data: {"event":"provider","provider":"kimi"}
data: {"event":"token","token":"Plants "}
data: {"event":"token","token":"make food "}
data: {"event":"token","token":"from sunlight."}
data: {"event":"done","message_id":501,"provider":"kimi"}
```

### User sends a new message while one is streaming (supersession)
```
(stream A for chat 42 is mid-flight)
POST /api/chats/42/stream   { "content": "Actually, summarize WW1" }
→ StreamManager.begin() sets A.cancel_event
→ stream A emits: data: {"event":"cancelled","reason":"superseded by a newer request","message_id":501}
→ stream A finalizes message 501 with its partial text
→ stream B starts fresh with a NEW placeholder (message_id 502)
```

### Explicit stop button
```
POST /api/chats/42/cancel   →   { "cancelled": true }
(client also AbortController.abort()s its fetch; partial text is preserved)
```

---

## Guarantees Checklist

- [x] **Never two active streams at once** — per-session lock + `begin()` supersede.
- [x] **Always cancel previous job first** — `begin()` sets prior `cancel_event`; client aborts + `/cancel`.
- [x] **Always update only the latest assistant message** — placeholder `assistant_id`
      bound to the generation; stale generations cannot attach/finalize a newer row.
- [x] **Clean streaming format** — structured single-object SSE JSON frames.
- [x] **No race conditions** — generation counter + lock; stale `finish()` is a no-op.
- [x] **Consistent state on disconnect** — `finally` always finalizes the placeholder.
- [x] **Model selection** — `auto` + `kimi`/`gemini`/`groq`, per-message override or saved pref.
