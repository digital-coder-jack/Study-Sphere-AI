# AI Chat System — Architecture

A ChatGPT-style multi-provider streaming chat system.
Providers: **Groq**, **Google Gemini**, **Kimi (Moonshot)** — switchable at runtime.

---

## 1. High-level System Diagram

```
                          ┌──────────────────────────────────────┐
                          │              CLIENTS                   │
                          │                                        │
   ┌──────────────────┐   │   ┌──────────────────┐                │
   │  Android App      │   │   │  Web App         │                │
   │  Jetpack Compose  │   │   │  Next.js / React │                │
   │  MVVM + Coroutines│   │   │  ReadableStream  │                │
   └────────┬──────────┘   │   └────────┬─────────┘                │
            │              └─────────────┼──────────────────────────┘
            │  POST /v1/chat/completions  │  (stream: true, SSE)
            │  Authorization: Bearer ...  │
            ▼                             ▼
   ╔══════════════════════════════════════════════════════════════╗
   ║                BACKEND GATEWAY (Node / Express)                 ║
   ║                  OpenAI-compatible API surface                  ║
   ║                                                                 ║
   ║   /v1/chat/completions   /v1/models   /healthz                  ║
   ║          │                                                      ║
   ║          ▼                                                      ║
   ║   ┌────────────────┐   resolves "model" => provider            ║
   ║   │  ModelRouter   │   groq | gemini | kimi | auto              ║
   ║   └───────┬────────┘                                           ║
   ║           │  unified ProviderRequest                            ║
   ║           ▼                                                     ║
   ║   ┌──────────────────────────────────────────────┐            ║
   ║   │            Provider interface                  │            ║
   ║   │  stream(req): AsyncIterable<StreamEvent>       │            ║
   ║   └───┬──────────────┬──────────────┬─────────────┘            ║
   ║       │              │              │                          ║
   ║   ┌───▼───┐     ┌────▼────┐    ┌────▼────┐                     ║
   ║   │ Groq  │     │ Gemini  │    │  Kimi   │  (each normalizes    ║
   ║   │adapter│     │ adapter │    │ adapter │   to StreamEvent)    ║
   ║   └───┬───┘     └────┬────┘    └────┬────┘                     ║
   ╚═══════│══════════════│══════════════│══════════════════════════╝
           ▼              ▼              ▼
      Groq API     Gemini API      Moonshot API
   (OpenAI-comp.) (generateContent)(OpenAI-comp.)
```

---

## 2. The Single Normalized Event: `StreamEvent`

Everything (client + backend) speaks one event shape regardless of provider.

```
StreamEvent =
  | { type: "start",  chatId, messageId, model }
  | { type: "token",  delta: string }            // append to last assistant msg
  | { type: "error",  message: string, fatal }   // recoverable vs fatal
  | { type: "done",   finishReason, usage? }      // finalize + refresh history
```

The backend converts each provider's raw stream → these events and re-emits
them over SSE as `data: {json}\n\n` lines. Clients only parse `StreamEvent`.

---

## 3. Critical Stability Rules (enforced everywhere)

| Rule | Where enforced | How |
|------|----------------|-----|
| Only ONE active stream per session | Android `ChatViewModel`, Web `useChatStream` | Hold a single `Job`/`AbortController`; cancel before starting a new one |
| Cancel previous before new request | ViewModel `streamingJob?.cancel()` | Structured concurrency; `ensureActive()` in collect loop |
| Update ONLY the latest assistant msg | `MessageReducer` | Token deltas target the message with `streamingMessageId` only |
| No duplicate assistant messages | `MessageReducer` | `start` creates exactly one placeholder; tokens never create messages |
| Graceful network errors | Repository + StreamClient | try/catch → emit `StreamEvent.Error` instead of throwing into UI |
| Retry failed stream once | Repository | `retryStreamOnce()` wrapper; re-subscribes on first transient failure |
| Fallback to non-stream | Repository | On second failure, call `completeNonStreaming()` and emit one big token |
| Race-condition-safe state | ViewModel | All mutations through `_uiState.update { }` (atomic) on `Dispatchers.Main.immediate` |

---

## 4. Provider Routing

```
model = "auto"   -> Groq (fast)  -> on failure Gemini -> on failure Kimi
model = "groq"   -> Groq
model = "gemini" -> Gemini
model = "kimi"   -> Kimi
```

`auto` is a cascading fallback chain implemented in `ModelRouter`.

---

## 5. Android Module Layout (Clean MVVM)

```
com.aichat.app
├── di/                  Hilt modules (network, db, repo)
├── domain/
│   ├── model/           ChatMessage, ChatSession, StreamEvent, AiModel
│   └── repository/      ChatRepository (interface)
├── data/
│   ├── remote/          ApiService (Retrofit), dto, SSE config
│   ├── local/           Room: entities, dao, db
│   ├── repository/      ChatRepositoryImpl
│   └── model/           mappers
├── stream/              StreamClient (robust SSE parser), SseParser
└── ui/
    ├── chat/            ChatViewModel, ChatScreen, ChatUiState, MessageReducer
    ├── history/         HistoryViewModel, HistoryScreen
    ├── components/      MessageBubble, TypingIndicator, ModelSelectorSheet, InputBar
    └── theme/           Theme, Color, Type
```

---

## 6. Data Flow (send a message)

```
UI(send) → ViewModel.sendMessage(text)
   ├─ streamingJob?.cancel()                 // RULE: cancel prev
   ├─ append user msg + empty assistant msg  // RULE: one placeholder
   ├─ streamingMessageId = assistant.id
   └─ streamingJob = scope.launch {
         repository.streamChat(chatId, history, model)   // Flow<StreamEvent>
           .onEach { ensureActive(); reduce(event) }     // RULE: update last only
           .catch { emit Error → fallback }
           .collect()
      }
reduce(token)  → _uiState.update { append delta to streamingMessageId }
reduce(done)   → finalize, persist to Room, trigger auto-title, refresh history
```
