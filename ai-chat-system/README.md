# AI Chat System (Groq + Gemini + Kimi)

A production-grade, ChatGPT-style multi-provider streaming chat system.

```
ai_chat_system/
├── docs/ARCHITECTURE.md     # full diagram + design + stability rules
├── backend/                 # OpenAI-compatible multi-provider gateway (Node/Express)
├── android/                 # Jetpack Compose app (clean MVVM + cancellation-safe streaming)
└── web/                     # React + Vite client (ReadableStream SSE)
```

## What it does
- One OpenAI-compatible API: `POST /v1/chat/completions { model, messages, stream }`
- `model` = `groq | gemini | kimi | auto`
- All providers normalized to a single `StreamEvent` shape: `start | token | error | done`
- `auto` = cascade Groq → Gemini → Kimi; streaming retried once, then non-streaming fallback

## Critical stability guarantees (enforced in code)
| Rule | Implementation |
|------|----------------|
| Only one active stream | `ChatViewModel.streamingJob` / web `abortRef` |
| Cancel previous before new | `streamingJob?.cancelAndJoin()` / `controller.abort()` |
| Update only latest assistant msg | `MessageReducer` targets `streamingMessageId` |
| No duplicate assistant bubbles | reducer never creates messages on `token` |
| Graceful network errors | repo/StreamClient emit `StreamEvent.Error`, never throw |
| Retry once + fallback | `ChatRepositoryImpl.streamChat` loop + `api.complete()` |
| Race-safe state | `MutableStateFlow.update {}` on `Main.immediate` |

---

## 1. Run the backend
```bash
cd backend
cp .env.example .env       # fill in GROQ_API_KEY / GEMINI_API_KEY / KIMI_API_KEY
npm install
npm start                  # http://localhost:8787
```
Test:
```bash
curl -N -H "Authorization: Bearer dev-secret-change-me" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"hello"}],"stream":true}' \
  http://localhost:8787/v1/chat/completions
```

## 2. Run the Android app
- Open `android/` in Android Studio (Giraffe+).
- Edit `app/build.gradle.kts` → `GATEWAY_BASE_URL` (emulator uses `http://10.0.2.2:8787/`) and `GATEWAY_API_KEY`.
- Run on an emulator/device.

## 3. Run the web client
```bash
cd web
cp .env.example .env       # set VITE_GATEWAY_URL / VITE_GATEWAY_KEY
npm install
npm run dev                # http://localhost:5173
```

See `docs/ARCHITECTURE.md` for the full diagram, module layout, and data flow.
