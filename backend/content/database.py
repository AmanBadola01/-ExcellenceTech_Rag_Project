"""
Database tables and data isolation helpers for the Content Studio.
Imports only from core (never from rag).
"""

from fastapi import HTTPException
from core.database import get_db


def init_content_db():
    """Initializes the companies, projects, and content_pieces tables for Content Studio."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id           TEXT NOT NULL UNIQUE,
                name              TEXT NOT NULL DEFAULT '',
                website           TEXT NOT NULL DEFAULT '',
                industry          TEXT NOT NULL DEFAULT '',
                tagline           TEXT NOT NULL DEFAULT '',
                description       TEXT NOT NULL DEFAULT '',
                products_services TEXT NOT NULL DEFAULT '',
                target_market     TEXT NOT NULL DEFAULT '',
                value_props       TEXT NOT NULL DEFAULT '',
                boilerplate       TEXT NOT NULL DEFAULT '',
                contact_info      TEXT NOT NULL DEFAULT '',
                default_language  TEXT NOT NULL DEFAULT 'en',
                created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                name        TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS content_pieces (
                id           TEXT PRIMARY KEY,
                user_id      TEXT NOT NULL,
                project_id   TEXT,
                title        TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'blog',
                status       TEXT NOT NULL DEFAULT 'draft',
                content      TEXT NOT NULL DEFAULT '',
                metadata     TEXT NOT NULL DEFAULT '{}',
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pieces_project ON content_pieces(project_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pieces_user ON content_pieces(user_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS brand_voices (
                id           TEXT PRIMARY KEY,
                user_id      TEXT NOT NULL,
                name         TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                tone_tags    TEXT NOT NULL DEFAULT '',
                rules        TEXT NOT NULL DEFAULT '',
                sample_quote TEXT NOT NULL DEFAULT '',
                created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_voices_user ON brand_voices(user_id)")


def get_user_company_record(user_id: str) -> dict:
    """
    Shared data isolation helper:
    Filters query strictly by user_id. Returns row dictionary if found.
    Raises HTTPException(404) if company record does not exist or belongs to another user.
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM companies WHERE user_id = ?",
            (str(user_id),),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Company profile not found.")
    return dict(row)


def get_user_project_record(project_id: str, user_id: str) -> dict:
    """
    Shared data isolation helper for projects:
    Filters query strictly by project_id and user_id.
    Raises HTTPException(404) if project does not exist or belongs to another user.
    """
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT p.*, COUNT(c.id) AS piece_count
            FROM projects p
            LEFT JOIN content_pieces c ON c.project_id = p.id
            WHERE p.id = ? AND p.user_id = ?
            GROUP BY p.id
            """,
            (str(project_id), str(user_id)),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Project not found.")
    return dict(row)



def get_user_voice_record(voice_id: str, user_id: str) -> dict:
    """Retrieves single brand voice with strict user isolation (raises 404 if not found)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM brand_voices WHERE id = ? AND user_id = ?",
            (str(voice_id), str(user_id)),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Brand voice not found.")
    return dict(row)
