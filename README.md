<div align="center">

# 🌌 AI Notebook

### ✨ Your Intelligent Learning Companion — now a full Web App + Telegram Bot

**Learn smarter. Explore deeper. Grow faster.**

🤖 Multi-Provider AI · 📚 Study Tools · 📱 Installable PWA · 🌍 Web + Telegram

</div>

---

## 📖 Overview

- **Name**: AI Notebook
- **Goal**: An AI-powered study assistant that works as a **modern installable web app (PWA)**, the original **Telegram bot**, sharing the **same FastAPI backend and SQLite database**.
- **AI**: **Multi-provider with automatic fallback** — **Kimi (Moonshot)** → **Google Gemini** → **Groq**. If one provider fails or is unconfigured, the next is tried automatically; if all fail, a graceful error is returned.

The original Telegram bot is **fully preserved** — it now benefits from the same multi-provider fallback automatically. A complete web interface (landing page, auth, dashboard, ChatGPT-style chat, 6 study tools, settings) is provided alongside it, now as a **Progressive Web App** that installs to Android/desktop.

### 🧠 AI System (new)
- **Providers**: Kimi (primary), Gemini (secondary), Groq (tertiary) — all free-tier compatible, OpenAI-style chat APIs.
- **Auto fallback chain**: `Kimi → Gemini → Groq → graceful error`.
- **Model selector**: choose **Auto / Kimi / Gemini / Groq** in the chat header and in Settings; the choice is **saved per user**.
- **Active model display**: the chat shows which provider actually answered (badge next to the assistant name).
- **Response caching** (in-process, TTL configurable via `AI_CACHE_TTL`), **streaming (SSE)**, **conversation memory**, **Markdown + code highlighting**.
- **Status monitoring**: `GET /api/ai/status` and `/api/health` report which providers are configured.
- **Security**: API keys (`KIMI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`) are read **only** from environment variables and **never** exposed to the frontend — all AI calls go through server-side routes.

### 📱 Progressive Web App (new)
- `manifest.json` (icons, shortcuts, standalone display, theme/splash colors)
- Service worker (`/sw.js`) — app-shell caching, **offline page** (`/offline.html`), update notifications, background-sync hook
- **Install app** button, standalone app mode, adaptive/maskable icons, network status banners
- Compatible with **PWABuilder** for Android APK generation

---

## 🚀 Completed Features

### 1. Landing Page (`/`)
Animated hero, **typing text effect**, **particles.js** background, **GSAP** entrance animations, **AOS** scroll reveals, glassmorphism cards, animated counters, feature showcase, testimonials, FAQ accordion, CTA band, footer.

### 2. Authentication
- Sign up (`/signup`), Log in (`/login`), Forgot/Reset password (`/forgot`)
- **PBKDF2-SHA256** password hashing (standard library — Vercel-safe)
- **JWT** session tokens (HS256, stdlib implementation)
- Profile page (`/profile`) — edit name, change password
- Secure logout

### 3. Dashboard (`/dashboard`)
Modern sidebar, user statistics (chats, messages, AI responses, notes/quizzes), **recent chats**, **daily activity line graph** (Chart.js), skeleton loaders.

### 4. AI Chat (`/chat`)
ChatGPT-style UI, **streaming responses (SSE)**, **Markdown rendering**, **code syntax highlighting** (highlight.js) with **copy button**, **download chat** (Markdown), chat history sidebar, **new chat**, **delete chat**, auto-titling.

### 5. Study Tools (`/tools`)
- **Notes Generator** (saved & re-viewable)
- **Quiz Generator** (interactive MCQ with scoring & explanations)
- **Flashcards** (3D flip animation)
- **Study Planner** (day-by-day plan)
- **PDF Summarizer** (upload PDF/DOCX/TXT or paste text)
- **Homework Helper** (step-by-step explanations)

### 6. File Upload
PDF (`pypdf`), DOCX (`python-docx`), TXT, and image storage — with server-side text extraction and AI summarisation.

### 7. Security
JWT auth · password hashing · Pydantic input validation · in-memory **rate limiting** · secret webhook verification · all secrets from environment variables.

### 8. Telegram Bot (unchanged)
`/start`, `/help`, `/add`, `/list`, `/delete` + AI fallback. Shares the same DB `questions` table and the same Groq client.

---

## 🔌 Functional Entry Points (URIs)

### Pages
| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/login`, `/signup`, `/forgot` | Authentication |
| `/dashboard` | User dashboard |
| `/chat`, `/chat?id=<id>` | AI chat interface |
| `/tools`, `/tools#<tab>` | Study tools |
| `/profile` | Profile & settings |
| `/telegram` | Telegram bot info & integration page |

### API — Auth (`/api/auth`)
| Method | Path | Body |
|--------|------|------|
| POST | `/signup` | `{name,email,password}` |
| POST | `/login` | `{email,password}` |
| POST | `/forgot-password` | `{email}` |
| POST | `/reset-password` | `{token,password}` |
| GET | `/me` | — (Bearer) |
| PUT | `/profile` | `{name}` (Bearer) |
| PUT | `/change-password` | `{current_password,new_password}` (Bearer) |

### API — Chat & Stats (`/api`)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/chats` | list / create |
| GET/PUT/DELETE | `/chats/{id}` | fetch / rename / delete |
| POST | `/chats/{id}/stream` | `{content}` → SSE token stream |
| GET | `/stats` | dashboard statistics |

### API — Study Tools (`/api/tools`)
`POST /notes`, `GET /notes`, `DELETE /notes/{id}` · `POST /quiz`, `GET /quiz`, `DELETE /quiz/{id}` · `POST /flashcards` · `POST /plan` · `POST /summarize` · `POST /homework`

### API — Files (`/api/files`)
`POST /upload` · `GET /` · `POST /{id}/summarize`

### API — Telegram (unchanged)
`POST /api/webhook` · `GET /api/set-webhook` · `GET /api/health`

---

## 🗄️ Data Architecture

- **Storage**: SQLite (single shared file). Path auto-switches to `/tmp` on Vercel.
- **Tables**:
  - `questions` — bot's personal Q&A library (**unchanged**)
  - `users` — web accounts (`telegram_id` links bot ↔ web)
  - `chats`, `messages` — AI conversations
  - `notes`, `quizzes` — saved study artefacts
  - `uploads` — file metadata + extracted text
- **Data flow**: Browser → Hono/FastAPI API (JWT) → shared `backend.database` → SQLite; AI requests → `backend.ai` → Groq. The Telegram bot uses the **same** modules.

> Note: Vercel's `/tmp` is ephemeral. For persistent production storage, set `DB_PATH` to a mounted volume or a hosted SQLite service (e.g. Turso).

---

## 📂 Project Structure

```
AINotebook/  (repo root)
├── api/
│   ├── index.py          # Vercel entry → backend.main:app
│   └── main.py           # Compatibility shim (old webhook path still works)
├── backend/
│   ├── main.py           # FastAPI app: web API + bot webhook + static frontend
│   ├── database.py       # Shared SQLite layer (bot + web)
│   ├── auth.py           # PBKDF2 hashing + JWT + FastAPI dependency
│   ├── ai.py             # Study logic (notes/quiz/flashcards/plan/summary/hw)
│   ├── groq_client.py    # Groq API (complete + streaming)
│   ├── ratelimit.py      # In-memory rate limiter
│   └── routes/
│       ├── users.py      # Auth & profile
│       ├── chat.py       # Chat, stats, study tools
│       └── files.py      # Uploads & extraction
├── telegram_bot/
│   └── bot.py            # The Telegram bot (shared backend, unchanged behaviour)
├── frontend/
│   ├── index.html login.html signup.html forgot.html
│   ├── dashboard.html chat.html tools.html profile.html
│   ├── css/  (style, auth, dashboard, chat, tools)
│   └── js/   (app, main, auth, sidebar, dashboard, chat, tools, profile)
├── requirements.txt
├── vercel.json
└── .env.example
```

---

## 🧑‍💻 User Guide

1. Open `/` → **Get started** → create an account.
2. Land on the **Dashboard** to see your stats.
3. Open **AI Chat** to ask questions (streaming, Markdown, code copy, download).
4. Open **Study Tools** to generate notes, quizzes, flashcards, plans, summaries or homework help.
5. Upload a PDF/DOCX/TXT in the **Summarizer** for an instant summary.
6. Manage your account in **Profile**.

---

## 🛠️ Local Development

```bash
pip install -r requirements.txt
cp .env.example .env        # fill in GROQ_API_KEY (and TELEGRAM_BOT_TOKEN if using the bot)
uvicorn backend.main:app --reload --port 3000
# open http://localhost:3000
```

### Environment variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | yes (for AI) | Groq API key |
| `GROQ_MODEL` | no | defaults to `llama-3.3-70b-versatile` |
| `JWT_SECRET` | recommended | stable token signing secret (set in prod) |
| `TELEGRAM_BOT_TOKEN` | bot only | Telegram bot token |
| `WEBHOOK_SECRET` | optional | verifies Telegram webhook calls |

---

## ☁️ Deployment (split: frontend on Vercel, backend on Render/Railway)

> The frontend stays on **Vercel**. The backend (this FastAPI app) is now a
> **standalone API** deployed to **Render** or **Railway**. See
> **`DEPLOYMENT.md`** for full step-by-step instructions.

### TL;DR
1. **Backend** → deploy this repo to Render (`render.yaml`) or Railway (`railway.json`).
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `gunicorn backend.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:$PORT --timeout 120`
   - **Health check**: `/api/health`
2. Copy the backend URL (e.g. `https://ai-notebook.onrender.com`).
3. **Frontend** → edit `frontend/js/config.js`, set
   `window.SS_API_BASE = "https://ai-notebook.onrender.com";` and redeploy on Vercel.
4. On the backend, set `ALLOWED_ORIGINS=https://<your-app>.vercel.app`.
5. **Telegram bot** (optional): visit `https://<backend-url>/api/set-webhook` once.

- **Platform**: Vercel (frontend) + Render/Railway (backend API) · **Status**: ✅ Ready
- **Tech**: FastAPI + Gunicorn/Uvicorn + Vanilla JS + Chart.js + Groq + MongoDB Atlas (analytics)
- **Last Updated**: 2026-06-21

### 🩹 Mobile/Navigation/Branding fixes (2026-06-21)
- **Sidebar layout root-cause fix**: `sidebar-mobile.css` previously set `.sidebar { position: fixed }` as a base rule (all widths) and only restored `sticky` at ≥1025px, while the mobile breakpoint was 880px. This pulled the sidebar out of flow on desktop/tablet, so the flex shell stopped reserving its column and the **dashboard content collapsed / appeared pushed down** (most visible in guest mode). Sidebar layout is now consolidated into a single source of truth (`sidebar-mobile.css`) with **one consistent 880px breakpoint**: sticky/in-flow on desktop, fixed off-canvas drawer on mobile. Duplicate `.sidebar`/`.side-*`/`.side-overlay` rules were removed from `dashboard.css`.
- **Mobile sidebar now works in guest mode**: `sidebar.js` no longer bails out (`if (!SS.requireAuth()) return;`) before wiring the hamburger. It renders + wires the drawer immediately and performs guest login in the background, refreshing the footer in place (no reload loop).
- **Drawer UX**: open/close via hamburger, backdrop tap, ESC, nav-item tap; backdrop blur; slide animations; safe-area padding; ≥48px tap targets; `aria-expanded`/`aria-hidden` handled per breakpoint.
- **Telegram page added**: new `/telegram` page + sidebar nav item + backend route (no more 404).
- **Branding**: removed gradient/badge boxes painted behind the official logo (sidebar header on app pages and the offline page). The uploaded logo (`/assets/logo.png`) is now shown cleanly with preserved proportions everywhere.

---

## 🚧 Not Yet Implemented / Next Steps
- Email delivery for password-reset tokens (currently returned directly for the demo flow).
- Optional OCR for uploaded images.
- Linking a Telegram account to a web account via `telegram_id` in the UI.
- Migrating from ephemeral SQLite to a hosted DB (Turso) for durable Vercel storage.

---

<div align="center">

### 🌌 AI Notebook — Learn • Explore • Grow

</div>
