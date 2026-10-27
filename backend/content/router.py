"""
Content Studio API router: /company endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, status

from core.security import get_current_user
from content import service
from content.schemas import (
    CompanyPayload,
    CompanyResponse,
    ProjectCreate,
    ProjectResponse,
    ContentPieceCreate,
    ContentPieceUpdate,
    ContentPieceResponse,
    GenerateContentRequest,
    RepurposeRequest,
    BrandVoiceCreate,
    BrandVoiceUpdate,
    BrandVoiceResponse,
)

router = APIRouter(prefix="", tags=["content"])


@router.get("/company", response_model=CompanyResponse)
def get_company(user=Depends(get_current_user)):
    """Retrieves the logged-in user's company profile (404 if not yet created)."""
    return service.get_company(user["user_id"])


@router.put("/company", response_model=CompanyResponse)
def update_company(body: CompanyPayload, user=Depends(get_current_user)):
    """Creates company profile on first save, updates on subsequent saves."""
    return service.upsert_company(user["user_id"], body)


# ── Projects Endpoints ────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(user=Depends(get_current_user)):
    """Returns all projects belonging to the logged-in user."""
    return service.list_projects(user["user_id"])


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, user=Depends(get_current_user)):
    """Creates a new project for the logged-in user."""
    return service.create_project(user["user_id"], body)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, user=Depends(get_current_user)):
    """Retrieves a specific project (404 if not found or belongs to another user)."""
    return service.get_project(user["user_id"], project_id)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, user=Depends(get_current_user)):
    """Deletes a project owned by the user."""
    service.delete_project(user["user_id"], project_id)
    return None



# ── Content Pieces Endpoints ──────────────────────────────────────────────────

@router.get("/pieces", response_model=List[ContentPieceResponse])
def list_all_pieces(limit: int = 20, user=Depends(get_current_user)):
    """Lists all content pieces for the user across projects and standalone."""
    return service.list_all_pieces(user["user_id"], limit=limit)


@router.get("/projects/{project_id}/pieces", response_model=List[ContentPieceResponse])
def list_project_pieces(project_id: str, user=Depends(get_current_user)):
    """Lists all content pieces belonging to the given project."""
    return service.list_project_pieces(user["user_id"], project_id)


@router.post("/pieces", response_model=ContentPieceResponse, status_code=status.HTTP_201_CREATED)
def create_piece(body: ContentPieceCreate, user=Depends(get_current_user)):
    """Creates a new content piece."""
    return service.create_piece(user["user_id"], body)


@router.get("/pieces/{piece_id}", response_model=ContentPieceResponse)
def get_piece(piece_id: str, user=Depends(get_current_user)):
    """Retrieves a single piece (404 if not found or unauthorized)."""
    return service.get_user_piece_record(piece_id, user["user_id"])


@router.delete("/pieces/{piece_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_piece(piece_id: str, user=Depends(get_current_user)):
    """Deletes a content piece."""
    service.delete_piece(user["user_id"], piece_id)
    return None


# ── Generation Endpoint ───────────────────────────────────────────────────────

@router.post("/generate", response_model=ContentPieceResponse, status_code=status.HTTP_201_CREATED)
def generate_content_endpoint(body: GenerateContentRequest, user=Depends(get_current_user)):
    """
    Generates content using Groq LLM with optional company background context
    and automatically saves it as a draft piece in app.db.
    """
    return service.generate_and_save_piece(user["user_id"], body)


@router.put("/pieces/{piece_id}", response_model=ContentPieceResponse)
def update_piece(piece_id: str, body: ContentPieceUpdate, user=Depends(get_current_user)):
    """Updates title, content, or status of an existing piece."""
    return service.update_piece(user["user_id"], piece_id, body)


@router.post("/pieces/{piece_id}/repurpose")
def repurpose_piece_endpoint(piece_id: str, body: RepurposeRequest, user=Depends(get_current_user)):
    """
    Repurposes an existing piece into another format (e.g. Twitter thread, LinkedIn post)
    using Groq's fast model.
    """
    return service.repurpose_piece(user["user_id"], piece_id, body)


# ── Brand Voices Endpoints ───────────────────────────────────────────────────

@router.get("/brand-voices", response_model=List[BrandVoiceResponse])
def list_brand_voices(user=Depends(get_current_user)):
    """Lists all brand voice personas for the user (auto-seeds defaults if empty)."""
    return service.list_brand_voices(user["user_id"])


@router.post("/brand-voices", response_model=BrandVoiceResponse, status_code=status.HTTP_201_CREATED)
def create_brand_voice(body: BrandVoiceCreate, user=Depends(get_current_user)):
    """Creates a new brand voice persona."""
    return service.create_brand_voice(user["user_id"], body)


@router.put("/brand-voices/{voice_id}", response_model=BrandVoiceResponse)
def update_brand_voice(voice_id: str, body: BrandVoiceUpdate, user=Depends(get_current_user)):
    """Updates an existing brand voice persona."""
    return service.update_brand_voice(user["user_id"], voice_id, body)


@router.delete("/brand-voices/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand_voice(voice_id: str, user=Depends(get_current_user)):
    """Deletes a brand voice persona."""
    service.delete_brand_voice(user["user_id"], voice_id)
    return None
