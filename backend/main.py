"""
FastAPI backend for Mini RAG Q&A and AI Content Studio.
"""

from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.config import ALLOWED_ORIGINS
from core.database import init_core_db
from core.security import create_token, get_current_user, verify_turnstile
from core.auth import create_user, verify_user
from rag.memory import init_rag_db
from rag.pipeline import RAGPipeline
from rag.router import router as rag_router
from content.database import init_content_db
from content.router import router as content_router

DEFAULT_DOCUMENT = "data/company_policy.txt"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts
    init_core_db()
    init_rag_db()
    init_content_db()

    pipeline = RAGPipeline()
    n = pipeline.index_document(DEFAULT_DOCUMENT)
    print(f"[RAG] Indexed {DEFAULT_DOCUMENT} into {n} chunks.")
    app.state.pipeline = pipeline
    yield


app = FastAPI(title="Mini RAG & AI Content Studio API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------- Auth models & routes

class Credentials(BaseModel):
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str
    turnstile_token: str | None = None


def _token_response(user_id: str, email: str) -> dict:
    email = email.strip().lower()
    return {
        "access_token": create_token(user_id, email),
        "token_type": "bearer",
        "email": email,
    }


auth_router = APIRouter(tags=["auth"])


@auth_router.post("/signup")
def signup(body: Credentials):
    user_id, error = create_user(body.email, body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return _token_response(user_id, body.email) # type: ignore


@auth_router.post("/login")
def login(body: LoginBody):
    if not verify_turnstile(body.turnstile_token):
        raise HTTPException(
            status_code=400,
            detail="Security check failed. Please verify that you are human.",
        )
    user_id = verify_user(body.email, body.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return _token_response(user_id, body.email)


@auth_router.get("/me")
def me(user=Depends(get_current_user)):
    return user


# --------------------------------------------------------------------- Root & Health

@app.get("/")
def root():
    return {
        "message": "Mini RAG & AI Content Studio API is running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# Mount auth routes under /api/auth and alias /auth for backward compatibility
app.include_router(auth_router, prefix="/api/auth")
app.include_router(auth_router, prefix="/auth")

# Mount RAG Q&A routes under /api/rag and alias root for backward compatibility
app.include_router(rag_router, prefix="/api/rag")
app.include_router(rag_router)

# Mount Content Studio routes under /api/content
app.include_router(content_router, prefix="/api/content")
