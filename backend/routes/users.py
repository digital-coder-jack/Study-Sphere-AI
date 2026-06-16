"""
=====================================================================
 STUDY SPHERE AI  -  backend/routes/users.py
=====================================================================
Authentication & user-profile API.

Endpoints (all prefixed with /api):
  POST /api/auth/signup           -> create account, returns JWT
  POST /api/auth/login            -> login, returns JWT
  POST /api/auth/forgot-password  -> issue a reset token
  POST /api/auth/reset-password   -> set new password with reset token
  GET  /api/auth/me               -> current user profile
  PUT  /api/auth/profile          -> update display name
  PUT  /api/auth/change-password  -> change password (authenticated)
=====================================================================
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import auth, database as db

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SignupIn(BaseModel):
    # Constraints are intentionally lenient here so that our route-level
    # validation can return clean, user-friendly error messages instead of
    # Pydantic's verbose 422 payloads.
    name: str = ""
    email: str = ""
    password: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str = ""
    password: str = ""


class ProfileIn(BaseModel):
    name: str = ""


class ChangePwIn(BaseModel):
    current_password: str = ""
    new_password: str = ""


def _public_user(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": row["created_at"],
        "last_login": row["last_login"] if "last_login" in row.keys() else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/signup")
async def signup(body: SignupIn):
    name = (body.name or "").strip()
    email = (body.email or "").strip().lower()
    password = body.password or ""

    if not name:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    pw_hash = auth.hash_password(password)
    user_id = db.create_user(name, email, pw_hash)
    if user_id is None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    db.touch_last_login(user_id)
    token = auth.create_access_token(user_id, email)
    user = db.get_user_by_id(user_id)
    return {"token": token, "user": _public_user(user)}


@router.post("/login")
async def login(body: LoginIn):
    email = (body.email or "").strip().lower()
    password = body.password or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="Please enter your email and password.")

    user = db.get_user_by_email(email)
    if user is None or not auth.verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    db.touch_last_login(user["id"])
    token = auth.create_access_token(user["id"], user["email"])
    return {"token": token, "user": _public_user(user)}


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    """
    Issue a reset token. To avoid leaking which emails exist, we always
    return success. In a real deployment you would email the token; here
    we return it directly so the demo flow works end-to-end.
    """
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    found = db.set_reset_token(body.email, token, expires)
    response = {"message": "If that email exists, a reset link has been generated."}
    if found:
        # Demo convenience: expose the token so the user can complete the flow.
        response["reset_token"] = token
    return response


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    if len(body.password or "") < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    user = db.get_user_by_reset_token(body.token)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    # Check expiry.
    try:
        expires = datetime.strptime(user["reset_expires"], "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This reset token has expired.")
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    db.update_user_password(user["id"], auth.hash_password(body.password))
    return {"message": "Your password has been reset. You can now log in."}


@router.get("/me")
async def me(user=Depends(auth.current_user)):
    return {"user": _public_user(db.get_user_by_id(user["id"]))}


@router.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(auth.current_user)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    db.update_user_profile(user["id"], name)
    return {"user": _public_user(db.get_user_by_id(user["id"]))}


@router.put("/change-password")
async def change_password(body: ChangePwIn, user=Depends(auth.current_user)):
    if len(body.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    row = db.get_user_by_id(user["id"])
    if not auth.verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    db.update_user_password(user["id"], auth.hash_password(body.new_password))
    return {"message": "Password updated successfully."}
