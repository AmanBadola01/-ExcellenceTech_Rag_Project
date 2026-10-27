"""
Core configuration and environment variables.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load from backend/.env or parent project root .env
load_dotenv()
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Unified SQLite database path
DB_PATH = DATA_DIR / "app.db"

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY")

# LLM configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")

# Groq configuration (for Content Studio)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Fast model for short-form, repurposing, hooks, and metadata
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "openai/gpt-oss-20b")
# High quality model for long-form content generation
GROQ_MODEL_QUALITY = os.getenv("GROQ_MODEL_QUALITY", "openai/gpt-oss-120b")

# CORS Origins
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080",
    ).split(",")
    if o.strip()
]

