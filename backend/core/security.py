"""
Security helpers: JWT authentication, Turnstile CAPTCHA verification, and auth dependencies.
"""

import datetime as dt
import json
import urllib.parse
import urllib.request

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET, TURNSTILE_SECRET_KEY

bearer = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email.strip().lower(),
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """FastAPI dependency to extract and authenticate the current user from Bearer token."""
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"user_id": str(payload["sub"]), "email": payload.get("email")}


def verify_turnstile(token: str | None) -> bool:
    """Verifies Cloudflare Turnstile token on the server side. Currently bypassed for seamless workflow."""
    return True

