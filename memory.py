import os
import sqlite3
import uuid
from contextlib import contextmanager

import bcrypt

DB_PATH = "data/chat.db"
HISTORY_TURNS = 6  # how many past messages to use for the rewrite

REWRITE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
]


@contextmanager
def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    with _conn() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    TEXT NOT NULL DEFAULT 'guest',
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL,          -- 'user' or 'assistant'
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute("CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id)")


# ---------------------------------------------------------------- users

def create_user(email: str, password: str):
    """Returns (user_id, error). user_id is None if signup failed."""
    email = email.strip().lower()

    if "@" not in email or "." not in email:
        return None, "Enter a valid email."
    if len(password) < 6:
        return None, "Password must be at least 6 characters."

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode() #Hashing the password

    try:
        with _conn() as con:
            cur = con.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, hashed),
            )
            user_id = str(cur.lastrowid)

            # The very first account adopts the old 'guest' chats
            count = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            if count == 1:
                con.execute(
                    "UPDATE messages SET user_id = ? WHERE user_id = 'guest'",
                    (user_id,),
                )
        return user_id, None
    except sqlite3.IntegrityError:
        return None, "That email is already registered."


def verify_user(email: str, password: str):
    """Returns user_id (str) if email + password are correct, else None."""
    email = email.strip().lower()
    with _conn() as con:
        row = con.execute(
            "SELECT id, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()

    if row and bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return str(row["id"])
    return None


# ------------------------------------------------------------- messages

def new_session_id() -> str:
    return uuid.uuid4().hex


def save_message(session_id, role, content, user_id):
    with _conn() as con:
        con.execute(
            "INSERT INTO messages (user_id, session_id, role, content) VALUES (?, ?, ?, ?)",
            (user_id, session_id, role, content),
        )


def load_history(session_id, user_id) -> list[dict]:
    """Only returns messages if the session belongs to this user."""
    with _conn() as con:
        rows = con.execute(
            "SELECT role, content FROM messages "
            "WHERE session_id = ? AND user_id = ? ORDER BY id",
            (session_id, user_id),
        ).fetchall()
    return [dict(r) for r in rows]


def list_sessions(user_id, limit=20) -> list[dict]:
    """This user's past chats, newest first. Title = first question of the chat."""
    with _conn() as con:
        rows = con.execute(
            """
            SELECT session_id,
                   (SELECT content FROM messages m2
                     WHERE m2.session_id = m.session_id AND m2.role = 'user'
                     ORDER BY id LIMIT 1) AS title
            FROM messages m
            WHERE user_id = ?
            GROUP BY session_id
            ORDER BY MAX(id) DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


# --------------------------------------------------- follow-up rewriting

def rewrite_question(question: str, history: list[dict]) -> str:
    """Turn a follow-up into a standalone question. Falls back to the original on any error."""
    if not history:
        return question

    recent = history[-HISTORY_TURNS:]
    convo = "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in recent)

    prompt = (
        "Rewrite the user's latest question so it makes sense on its own, "
        "using the conversation for context. Resolve words like 'it', 'that', 'them', "
        "'what about...'. If it's already standalone, return it unchanged. "
        "Return ONLY the rewritten question, nothing else.\n\n"
        f"Conversation:\n{convo}\n\n"
        f"Latest question: {question}\n\n"
        "Standalone question:"
    )

    try:
        from google import genai
        from google.genai import types
        client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY from env
    except Exception as e:
        print(f"[memory] Gemini client failed, using original question: {e}")
        return question

    for model in REWRITE_MODELS:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0),
            )
            text = (resp.text or "").strip()
            if text:
                return text
        except Exception as e:
            print(f"[memory] {model} failed: {e}")

    return question
