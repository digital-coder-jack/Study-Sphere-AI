"""
=====================================================================
 STUDY SPHERE AI  -  backend/main.py
=====================================================================
The single FastAPI application that powers BOTH:

  1. The Telegram bot  (webhook endpoints — unchanged behaviour)
  2. The web application  (auth, chat, study tools, file uploads)
  3. The static frontend  (served from /frontend)

Everything shares backend.database (one SQLite file) and backend.ai
(one Groq client), so the bot and the website operate on the same data.

Run locally:
    uvicorn backend.main:app --reload --port 3000
On Vercel: api/index.py imports this `app`.
=====================================================================
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from telegram import Update

from backend import database as db
from backend.routes import chat as chat_routes
from backend.routes import files as files_routes
from backend.routes import users as users_routes

# Rate limiting (simple in-memory token bucket per IP).
from backend.ratelimit import RateLimitMiddleware

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("study-sphere")

# Resolve the frontend directory (works locally and on Vercel).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")

app = FastAPI(title="Study Sphere AI", docs_url=None, redoc_url=None)

# CORS — the frontend is served from the same origin, but allow API use
# from elsewhere too (e.g. local dev tools).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting for API routes.
app.add_middleware(RateLimitMiddleware)

# Ensure the database schema exists as soon as the app boots.
db.init_db()

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
app.include_router(users_routes.router)
app.include_router(chat_routes.router)
app.include_router(files_routes.router)


# ---------------------------------------------------------------------------
# Health / API status
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "app": "Study Sphere AI",
        "storage": "sqlite",
        "ai_configured": bool(os.environ.get("GROQ_API_KEY")),
        "bot_configured": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
    }


# ===========================================================================
# TELEGRAM BOT WEBHOOK  (behaviour identical to the original bot)
# ===========================================================================
@app.post("/api/webhook")
async def telegram_webhook(request: Request) -> Response:
    """Telegram posts every update here; we hand it to python-telegram-bot."""
    from telegram_bot.bot import get_ptb_app

    secret = os.environ.get("WEBHOOK_SECRET")
    if secret:
        header = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if header != secret:
            logger.warning("Rejected webhook call with invalid secret token")
            return Response(status_code=403)

    try:
        application = await get_ptb_app()
        data = await request.json()
        update = Update.de_json(data, application.bot)
        await application.process_update(update)
    except Exception:
        logger.exception("Failed to process webhook update")

    return Response(status_code=200)


@app.get("/api/set-webhook")
async def set_webhook(request: Request) -> dict:
    """One-time helper: visit after deploying to register the webhook."""
    from telegram_bot.bot import get_ptb_app

    application = await get_ptb_app()
    host = request.headers.get("x-forwarded-host") or request.url.hostname
    webhook_url = f"https://{host}/api/webhook"
    ok = await application.bot.set_webhook(
        url=webhook_url,
        secret_token=os.environ.get("WEBHOOK_SECRET") or None,
        drop_pending_updates=True,
    )
    logger.info("Webhook set to %s (ok=%s)", webhook_url, ok)
    return {"webhook_set": ok, "url": webhook_url}


# ===========================================================================
# STATIC FRONTEND
# ===========================================================================
# Mount CSS / JS / assets under their folders so links like /css/style.css work.
if os.path.isdir(FRONTEND_DIR):
    for sub in ("css", "js", "assets"):
        path = os.path.join(FRONTEND_DIR, sub)
        if os.path.isdir(path):
            app.mount(f"/{sub}", StaticFiles(directory=path), name=sub)


def _page(name: str) -> FileResponse | JSONResponse:
    file_path = os.path.join(FRONTEND_DIR, name)

    if os.path.isfile(file_path):
        return FileResponse(file_path)

    return JSONResponse({"detail": "Page not found"}, status_code=404)


FAVICON_SVG = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
    "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
    "<stop offset='0' stop-color='#6d7bff'/><stop offset='0.5' stop-color='#a855f7'/>"
    "<stop offset='1' stop-color='#22d3ee'/></linearGradient></defs>"
    "<rect width='100' height='100' rx='22' fill='url(#g)'/>"
    "<text x='50' y='68' font-size='56' text-anchor='middle'>🌌</text></svg>"
)


@app.get("/favicon.ico")
@app.get("/favicon.svg")
async def favicon():
    return Response(content=FAVICON_SVG, media_type="image/svg+xml")


@app.get("/")
async def index():
    return _page("index.html")


@app.get("/login")
@app.get("/login.html")
async def login_page():
    return _page("login.html")


@app.get("/signup")
@app.get("/signup.html")
async def signup_page():
    return _page("signup.html")


@app.get("/forgot")
@app.get("/forgot.html")
async def forgot_page():
    return _page("forgot.html")


@app.get("/dashboard")
@app.get("/dashboard.html")
async def dashboard_page():
    return _page("dashboard.html")


@app.get("/chat")
@app.get("/chat.html")
async def chat_page():
    return _page("chat.html")


@app.get("/tools")
@app.get("/tools.html")
async def tools_page():
    return _page("tools.html")


@app.get("/profile")
@app.get("/profile.html")
async def profile_page():
    return _page("profile.html")


# Generic fallback for any other top-level .html file.
@app.get("/{page}.html")
async def any_page(page: str):
    return _page(f"{page}.html")


# ---------------------------------------------------------------------------
# Local development entry point (ignored by Vercel).
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=3000, reload=True)
