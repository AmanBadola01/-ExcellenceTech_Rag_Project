"""
RAG Chat API router: /chats endpoints.
Only imports from core (never from content).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.security import get_current_user
from rag import memory

router = APIRouter(tags=["rag"])


class AskBody(BaseModel):
    question: str


def get_pipeline(request: Request):
    pipeline = getattr(request.app.state, "pipeline", None)
    if not pipeline:
        raise HTTPException(status_code=503, detail="RAG Pipeline is still initializing.")
    return pipeline


@router.get("/chats")
def list_chats(user=Depends(get_current_user)):
    """The logged-in user's chats, newest first."""
    sessions = memory.list_sessions(user["user_id"])
    return [{"id": s["session_id"], "title": s["title"] or "Untitled"} for s in sessions]


@router.post("/chats")
def new_chat(user=Depends(get_current_user)):
    """Hands out a fresh chat id. Saved once the first question is asked."""
    return {"id": memory.new_session_id()}


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str, user=Depends(get_current_user)):
    """Messages of one chat (empty list if it isn't yours or doesn't exist)."""
    return memory.load_history(chat_id, user["user_id"])


@router.post("/chats/{chat_id}/ask")
def ask(
    chat_id: str,
    body: AskBody,
    request: Request,
    user=Depends(get_current_user),
):
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty.")

    user_id = user["user_id"]
    history = memory.load_history(chat_id, user_id)

    standalone = memory.rewrite_question(question, history)
    pipeline = get_pipeline(request)
    result = pipeline.ask(standalone)

    memory.save_message(chat_id, "user", question, user_id)
    memory.save_message(chat_id, "assistant", result["answer"], user_id)

    return {
        "answer": result["answer"],
        "searched_as": standalone if standalone != question else None,
        "sources": [
            {"text": chunk, "score": float(score)} for chunk, score in result["sources"]
        ],
    }

