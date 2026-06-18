"""
Vercel serverless entry point for Study Sphere AI.

Vercel's @vercel/python runtime imports the `app` object from this file.
All real logic lives in backend.main; this file only wires it up and makes
sure the project root is importable so `backend` and `telegram_bot` packages
resolve correctly.
"""

import os
import sys

# Make the project root importable (so `import backend...` works on Vercel).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.main import app  # noqa: E402  (import after sys.path tweak)

# Vercel looks for a module-level `app` (ASGI) object.
__all__ = ["app"]
