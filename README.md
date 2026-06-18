<div align="center">

# 🌌 Study Sphere AI

### ✨ Your Intelligent Learning Companion — now a full Web App + Telegram Bot

**Learn smarter. Explore deeper. Grow faster.**

🤖 AI Powered · 📚 Study Tools · ⚡ Fast (Groq) · 🌍 Web + Telegram

</div>

---

## 📖 Overview

- **Name**: Study Sphere AI
- **Goal**: An AI-powered study assistant that works as both a **modern web application** and the original **Telegram bot**, sharing the **same FastAPI backend and SQLite database**.
- **AI**: Groq Chat Completions — model `llama-3.3-70b-versatile`.

The original Telegram bot is **fully preserved and unchanged in behaviour**. A complete web interface (landing page, auth, dashboard, ChatGPT-style chat, and 6 study tools) has been added alongside it.

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
StudySphereAI/  (repo root)
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
2. Copy the backend URL (e.g. `https://study-sphere-ai.onrender.com`).
3. **Frontend** → edit `frontend/js/config.js`, set
   `window.SS_API_BASE = "https://study-sphere-ai.onrender.com";` and redeploy on Vercel.
4. On the backend, set `ALLOWED_ORIGINS=https://<your-app>.vercel.app`.
5. **Telegram bot** (optional): visit `https://<backend-url>/api/set-webhook` once.

- **Platform**: Vercel (frontend) + Render/Railway (backend API) · **Status**: ✅ Ready
- **Tech**: FastAPI + Gunicorn/Uvicorn + Vanilla JS + Chart.js + Groq + MongoDB Atlas (analytics)
- **Last Updated**: 2026-06-18

---

## 🚧 Not Yet Implemented / Next Steps
- Email delivery for password-reset tokens (currently returned directly for the demo flow).
- Optional OCR for uploaded images.
- Linking a Telegram account to a web account via `telegram_id` in the UI.
- Migrating from ephemeral SQLite to a hosted DB (Turso) for durable Vercel storage.

---

<div align="center">

### 🌌 Study Sphere AI — Learn • Explore • Grow

</div>
