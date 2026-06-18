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

from datetime import datetime
from fastapi import FastAPI, Request, Response, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend import database as db
from backend.routes import chat as chat_routes
from backend.routes import files as files_routes
from backend.routes import users as users_routes
from backend.analytics_web import web_analytics_db
from backend.auth import current_user

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


# ---------------------------------------------------------------------------
# Environment variable validation
# ---------------------------------------------------------------------------
# The backend will still boot if optional vars are missing (so health checks
# pass on a fresh deploy), but it logs loud warnings so misconfiguration is
# obvious in the platform logs. Set FAIL_FAST=1 to abort startup instead.
def _validate_environment() -> None:
    """Validate and report on the environment configuration at boot."""
    required_for_ai = {
        "GROQ_API_KEY": "AI chat, notes, quizzes, flashcards, plans, summaries",
    }
    recommended = {
        "JWT_SECRET": "stable session signing secret (logins break on restart without it)",
        "ALLOWED_ORIGINS": "comma-separated list of frontend origins allowed by CORS",
    }
    optional = {
        "GROQ_MODEL": "override default Groq model (llama-3.3-70b-versatile)",
        "MONGODB_URI_WEB": "MongoDB Atlas URI for web-analytics dashboard",
        "TELEGRAM_BOT_TOKEN": "Telegram bot integration",
        "WEBHOOK_SECRET": "verify Telegram webhook calls",
        "DB_PATH": "persistent SQLite path (set to a mounted disk in production)",
        "TELEGRAM_ADMIN_ID": "admin id allowed to read analytics dashboard stats",
    }

    missing_required = [k for k in required_for_ai if not os.environ.get(k)]
    missing_recommended = [k for k in recommended if not os.environ.get(k)]

    logger.info("=" * 60)
    logger.info("Study Sphere AI — environment check")
    for key, why in required_for_ai.items():
        status = "OK" if os.environ.get(key) else "MISSING"
        logger.info("  [%s] %-18s — %s", status, key, why)
    for key, why in recommended.items():
        status = "OK" if os.environ.get(key) else "not set"
        logger.info("  [%s] %-18s — %s", status, key, why)
    for key, why in optional.items():
        if os.environ.get(key):
            logger.info("  [OK] %-18s — %s", key, why)
    logger.info("=" * 60)

    if missing_required:
        logger.warning(
            "Missing REQUIRED env var(s): %s — AI features will return a "
            "configuration message until these are set.",
            ", ".join(missing_required),
        )
    if missing_recommended:
        logger.warning(
            "Missing recommended env var(s): %s — strongly advised in production.",
            ", ".join(missing_recommended),
        )

    if os.environ.get("FAIL_FAST") == "1" and missing_required:
        raise RuntimeError(
            "FAIL_FAST=1 and required env vars are missing: "
            + ", ".join(missing_required)
        )


_validate_environment()

app = FastAPI(title="Study Sphere AI", docs_url=None, redoc_url=None)

# ---------------------------------------------------------------------------
# CORS — the frontend now lives on a DIFFERENT origin (Vercel) than this API
# (Render / Railway), so CORS must explicitly allow that origin.
#
# Configure with the ALLOWED_ORIGINS env var, e.g.:
#   ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.com
#
# Comma-separated. If unset, we fall back to "*" (open) so the app keeps
# working out-of-the-box, but you should pin it to your real frontend
# origin(s) in production. We also allow all *.vercel.app preview URLs via a
# regex so Vercel preview deployments work without reconfiguring.
# ---------------------------------------------------------------------------
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _raw_origins:
    ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True
else:
    ALLOWED_ORIGINS = ["*"]
    _allow_credentials = False  # "*" + credentials is invalid per the CORS spec

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    # Always permit Vercel preview/prod deployments + localhost dev.
    allow_origin_regex=r"https://([a-z0-9-]+\.)*vercel\.app|http://localhost(:\d+)?",
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)

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
# Web Analytics API Routes (MongoDB Atlas)
#
# These accept JSON request BODIES to match exactly what
# frontend/js/analytics-tracker.js sends. (The previous version declared the
# fields as query parameters, which made every analytics call fail with 422.)
# All handlers are defensive so analytics never breaks the page if Mongo is
# unavailable.
# ---------------------------------------------------------------------------
class TrackVisitIn(BaseModel):
    guest_id: str
    page_url: str = "/"


class TrackActivityIn(BaseModel):
    guest_id: str
    current_page: str = "/"
    time_spent_on_page: float = 0.0


class TrackSessionEndIn(BaseModel):
    guest_id: str
    session_start: datetime
    session_end: datetime


class TrackFeatureIn(BaseModel):
    guest_id: str
    feature: str


@app.post("/api/analytics/track-visit")
async def track_visit_endpoint(body: TrackVisitIn, request: Request):
    try:
        user_agent = request.headers.get("User-Agent", "Unknown")
        ip_address = request.client.host if request.client else "unknown"
        web_analytics_db.track_visit(body.guest_id, user_agent, ip_address, body.page_url)
    except Exception:
        logger.exception("track_visit failed")
    return {"status": "ok"}


@app.post("/api/analytics/track-activity")
async def track_activity_endpoint(body: TrackActivityIn):
    try:
        web_analytics_db.update_activity(
            body.guest_id, body.current_page, body.time_spent_on_page
        )
    except Exception:
        logger.exception("track_activity failed")
    return {"status": "ok"}


@app.post("/api/analytics/track-session-end")
async def track_session_end_endpoint(body: TrackSessionEndIn):
    try:
        web_analytics_db.track_session_end(
            body.guest_id, body.session_start, body.session_end
        )
    except Exception:
        logger.exception("track_session_end failed")
    return {"status": "ok"}


@app.post("/api/analytics/track-feature")
async def track_feature_endpoint(body: TrackFeatureIn):
    try:
        web_analytics_db.track_feature_usage(body.guest_id, body.feature)
    except Exception:
        logger.exception("track_feature failed")
    return {"status": "ok"}

# Admin Dashboard API Route
@app.get("/api/analytics/dashboard-stats")
async def get_dashboard_stats_endpoint(current_user: dict = Depends(current_user)):
    # Basic admin check: assuming an admin user has a specific ID or role
    # For now, let's assume TELEGRAM_ADMIN_ID is also the web admin ID for simplicity
    admin_id = os.environ.get("TELEGRAM_ADMIN_ID") # Reusing for web admin check
    if not admin_id or str(current_user.get("id")) != admin_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stats = web_analytics_db.get_dashboard_stats()
    return stats


# ---------------------------------------------------------------------------
# Health / API status
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "app": "Study Sphere AI",
        "storage": "sqlite",
        "db_path": db.DB_PATH,
        "ai_configured": bool(os.environ.get("GROQ_API_KEY")),
        "bot_configured": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
        "mongo_analytics_configured": bool(os.environ.get("MONGODB_URI_WEB")),
        "cors_allowed_origins": ALLOWED_ORIGINS,
    }


@app.get("/api")
async def api_root_status() -> dict:
    """Friendly JSON status at the API base."""
    return {
        "status": "ok",
        "service": "Study Sphere AI — backend API",
        "health": "/api/health",
    }


# ===========================================================================
# TELEGRAM BOT WEBHOOK  (behaviour identical to the original bot)
# ===========================================================================
@app.post("/api/webhook")
async def telegram_webhook(request: Request) -> Response:
    """Telegram posts every update here; we hand it to python-telegram-bot."""
    # Imported lazily so a missing/broken telegram dependency never prevents
    # the whole API from booting — only the webhook route would be affected.
    from telegram import Update
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
    fav_path = os.path.join(FRONTEND_DIR, "assets", "logo.png")
    if os.path.exists(fav_path):
        return FileResponse(fav_path)
    return Response(content=FAVICON_SVG, media_type="image/svg+xml")


@app.get("/")
async def index():
    # If the frontend is bundled with this backend (single-origin deploy),
    # serve it. Otherwise (API-only deploy, frontend on Vercel) return a
    # friendly JSON status so hitting the API root never shows a raw 404.
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse(
        {
            "status": "ok",
            "service": "Study Sphere AI — backend API",
            "health": "/api/health",
            "note": "Frontend is hosted separately (e.g. Vercel).",
        }
    )


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


@app.get("/analytics")
@app.get("/analytics.html")
async def analytics_page():
    return _page("analytics.html")


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
