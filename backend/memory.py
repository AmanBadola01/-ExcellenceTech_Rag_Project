"""
Compatibility shim redirecting to core and rag packages.
"""

from core.database import get_db, init_core_db
from core.auth import create_user, verify_user, validate_password
from rag.memory import (
    init_rag_db,
    new_session_id,
    save_message,
    load_history,
    list_sessions,
    rewrite_question,
)

def init_db():
    init_core_db()
    init_rag_db()
