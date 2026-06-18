"""
=====================================================================
 STUDY SPHERE AI  -  api/main.py  (compatibility shim)
=====================================================================
The original project shipped the entire Telegram bot inside this single
file. The bot has now been refactored into reusable modules under
`backend/` and `telegram_bot/`, and a full web application has been added
alongside it — WITHOUT changing any existing bot behaviour or endpoints.

This file is kept so that any previously-configured Vercel route or
Telegram webhook that points at `api/main.py` keeps working unchanged:
it simply re-exports the same FastAPI `app` that powers everything.

  * /api/webhook       -> Telegram bot (identical behaviour)
  * /api/set-webhook   -> webhook registration helper (identical)
  * /                  -> the new web application
  * /api/...           -> web app API

All logic lives in backend.main.
=====================================================================
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.main import app  # noqa: E402

__all__ = ["app"]
