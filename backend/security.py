"""
Compatibility shim redirecting to core.security.
"""

from core.security import (
    bearer,
    hash_password,
    check_password,
    create_token,
    get_current_user,
    verify_turnstile,
)
