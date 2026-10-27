"""
RAG Chat Memory: chat history per user and follow-up question rewrites.
Only imports from core (never from content).
"""

import uuid
from core.database import get_db

HISTORY_TURNS = 6

REWRITE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
]


def init_rag_db():
    """Initializes the Q&A messages table in the unified database."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    TEXT NOT NULL DEFAULT 'guest',
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL,          -- 'user' or 'assistant'
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id)")


def new_session_id() -> str:
    return uuid.uuid4().hex


def save_message(session_id: str, role: str, content: str, user_id: str):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO messages (user_id, session_id, role, content) VALUES (?, ?, ?, ?)",
            (str(user_id), session_id, role, content),
        )


def load_history(session_id: str, user_id: str) -> list[dict]:
    """Returns messages if the session belongs to this user."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages "
            "WHERE session_id = ? AND user_id = ? ORDER BY id",
            (session_id, str(user_id)),
        ).fetchall()
    return [dict(r) for r in rows]


def list_sessions(user_id: str, limit: int = 20) -> list[dict]:
    """The user's past chats, newest first. Title = first user question."""
    with get_db() as conn:
        rows = conn.execute(
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
            (str(user_id), limit),
        ).fetchall()
    return [dict(r) for r in rows]


def rewrite_question(question: str, history: list[dict]) -> str:
    """Rewrites a follow-up into a standalone question using conversation context."""
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
        f"Standalone question:"
    )

    try:
        from google import genai
        from google.genai import types
        client = genai.Client()
    except Exception as e:
        print(f"[rag.memory] Gemini client initialization skipped: {e}")
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
            print(f"[rag.memory] {model} rewrite error: {e}")

    return question

