"""
JWT helpers: create a token at login, check it on every protected request.
"""

import datetime as dt
import os

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

SECRET = os.getenv("JWT_SECRET")
if not SECRET:
    raise RuntimeError(
        "JWT_SECRET missing in .env. Generate one with:\n"
        '  python -c "import secrets; print(secrets.token_hex(32))"'
    )

ALGORITHM = "HS256"
EXPIRE_HOURS = 24 * 7  # token valid for 7 days

bearer = HTTPBearer()  # makes the "Authorize" button show up in /docs


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    """Use as a dependency: user = Depends(get_current_user)."""
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user_id": payload["sub"], "email": payload.get("email")}
