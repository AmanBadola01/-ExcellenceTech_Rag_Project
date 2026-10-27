"""
Core database connection and shared schema initialization.
"""

import os
import shutil
import sqlite3
from contextlib import contextmanager

from core.config import DATA_DIR, DB_PATH


def _migrate_old_db_if_needed():
    """Migrate legacy chat.db to app.db if app.db does not exist yet."""
    old_db = DATA_DIR / "chat.db"
    if old_db.exists() and not DB_PATH.exists():
        try:
            shutil.copy2(old_db, DB_PATH)
            print(f"[Database] Migrated existing data from {old_db.name} to {DB_PATH.name}")
        except Exception as e:
            print(f"[Database] Could not copy {old_db} to {DB_PATH}: {e}")


@contextmanager
def get_db():
    """Context manager for SQLite connections with auto-commit."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_core_db():
    """Initialize shared database tables (users)."""
    _migrate_old_db_if_needed()
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

