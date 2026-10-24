"""
FastAPI backend for the Mini RAG Q&A system.

Run from the backend/ folder:
    uvicorn main:app --reload
Then open http://127.0.0.1:8000/docs
"""

from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import memory
from rag.pipeline import RAGPipeline
from security import create_token, get_current_user

DEFAULT_DOCUMENT = "data/company_policy.txt"
state = {}  # holds the pipeline so every request can use it


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts
    memory.init_db()
    pipeline = RAGPipeline()
    n = pipeline.index_document(DEFAULT_DOCUMENT)
    print(f"Indexed {DEFAULT_DOCUMENT} into {n} chunks.")
    state["pipeline"] = pipeline
    yield


app = FastAPI(title="Mini RAG Q&A API", lifespan=lifespan)

# Lets the React dev server (Vite / TanStack, ports 5173, 8080, 3000) call this API

import os

origins = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------- request models

class Credentials(BaseModel):
    email: str
    password: str


class AskBody(BaseModel):
    question: str


# --------------------------------------------------------------------- misc

@app.get("/health")
def health():
    return {"status": "ok"}


# --------------------------------------------------------------------- auth

def _token_response(user_id: str, email: str) -> dict:
    email = email.strip().lower()
    return {
        "access_token": create_token(user_id, email),
        "token_type": "bearer",
        "email": email,
    }

# Creating new user
@app.post("/auth/signup")
def signup(body: Credentials):
    user_id, error = memory.create_user(body.email, body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return _token_response(user_id, body.email)

# Login 
@app.post("/auth/login")
def login(body: Credentials):
    user_id = memory.verify_user(body.email, body.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return _token_response(user_id, body.email)


@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return user


# -------------------------------------------------------------------- chats

@app.get("/chats")
def list_chats(user=Depends(get_current_user)):
    """The logged-in user's chats, newest first."""
    sessions = memory.list_sessions(user["user_id"])
    return [{"id": s["session_id"], "title": s["title"] or "Untitled"} for s in sessions]


@app.post("/chats")
def new_chat(user=Depends(get_current_user)):
    """Just hands out a fresh chat id. The chat is saved once the first question is asked."""
    return {"id": memory.new_session_id()}


@app.get("/chats/{chat_id}")
def get_chat(chat_id: str, user=Depends(get_current_user)):
    """Messages of one chat (empty list if it isn't yours or doesn't exist)."""
    return memory.load_history(chat_id, user["user_id"])


@app.post("/chats/{chat_id}/ask")
def ask(chat_id: str, body: AskBody, user=Depends(get_current_user)):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty.")

    user_id = user["user_id"]
    history = memory.load_history(chat_id, user_id)

    standalone = memory.rewrite_question(question, history)
    result = state["pipeline"].ask(standalone)

    memory.save_message(chat_id, "user", question, user_id)
    memory.save_message(chat_id, "assistant", result["answer"], user_id)

    return {
        "answer": result["answer"],
        "searched_as": standalone if standalone != question else None,
        "sources": [
            {"text": chunk, "score": float(score)} for chunk, score in result["sources"]
        ],
    }
