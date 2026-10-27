"""
Pydantic schemas for the AI Content Studio Company model.
"""

from typing import Optional
from pydantic import BaseModel


class CompanyPayload(BaseModel):
    name: str = ""
    website: str = ""
    industry: str = ""
    tagline: str = ""
    description: str = ""
    products_services: str = ""
    target_market: str = ""
    value_props: str = ""
    boilerplate: str = ""
    contact_info: str = ""
    default_language: str = "en"


class CompanyResponse(CompanyPayload):
    id: int
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str = ""
    piece_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ContentPieceCreate(BaseModel):
    project_id: Optional[str] = None
    title: str
    content_type: str = "blog"
    status: str = "draft"
    content: str = ""
    metadata: str = "{}"


class ContentPieceResponse(BaseModel):
    id: str
    user_id: str
    project_id: Optional[str] = None
    title: str
    content_type: str = "blog"
    status: str = "draft"
    content: str = ""
    metadata: str = "{}"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None



class GenerateContentRequest(BaseModel):
    title: str
    prompt: str
    content_type: str = "blog"  # "blog", "social", "email", "press_release", "ad_copy"
    tone: str = "Professional"
    voice_id: Optional[str] = None
    project_id: Optional[str] = None
    include_company_context: bool = True


class ContentPieceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


class RepurposeRequest(BaseModel):
    target_format: str  # "twitter_thread", "linkedin_post", "tldr_summary", "email_teaser"
    instructions: Optional[str] = ""
    save_as_new_piece: bool = True


class BrandVoiceCreate(BaseModel):
    name: str
    description: str = ""
    tone_tags: str = ""
    rules: str = ""
    sample_quote: str = ""


class BrandVoiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tone_tags: Optional[str] = None
    rules: Optional[str] = None
    sample_quote: Optional[str] = None


class BrandVoiceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str = ""
    tone_tags: str = ""
    rules: str = ""
    sample_quote: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

