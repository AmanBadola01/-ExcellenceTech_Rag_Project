"""
User management: signup, validation, and verification using shared users table.
"""

import re
import sqlite3

from core.database import get_db
from core.security import check_password, hash_password


def validate_password(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must include at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must include at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must include at least one special character."
    return None


def create_user(email: str, password: str) -> tuple[str | None, str | None]:
    """Returns (user_id, error). user_id is None if signup failed."""
    email = email.strip().lower()

    if "@" not in email or "." not in email:
        return None, "Enter a valid email."

    pw_error = validate_password(password)
    if pw_error:
        return None, pw_error

    hashed = hash_password(password)

    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, hashed),
            )
            user_id = str(cur.lastrowid)

            # Check if this is the very first account; if so, adopt legacy guest chats if present
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            if count == 1:
                try:
                    conn.execute(
                        "UPDATE messages SET user_id = ? WHERE user_id = 'guest'",
                        (user_id,),
                    )
                except Exception:
                    pass
        return user_id, None
    except sqlite3.IntegrityError:
        return None, "That email is already registered."


def verify_user(email: str, password: str) -> str | None:
    """Returns user_id (str) if email + password are correct, else None."""
    email = email.strip().lower()
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()

    if row and check_password(password, row["password_hash"]):
        return str(row["id"])
    return None

