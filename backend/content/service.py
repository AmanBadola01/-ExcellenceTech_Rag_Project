"""
Business logic service for the Content Studio Company profile.
"""

import uuid
import json
from typing import List, Optional
from fastapi import HTTPException
from core.database import get_db
from content.database import (
    get_user_company_record,
    get_user_project_record,
    get_user_voice_record,
)
from content.schemas import (
    CompanyPayload,
    ProjectCreate,
    ProjectUpdate,
    ContentPieceCreate,
    ContentPieceUpdate,
    GenerateContentRequest,
    RepurposeRequest,
    BrandVoiceCreate,
    BrandVoiceUpdate,
)
from content.llm import generate_content


def get_company(user_id: str) -> dict:
    """Retrieves the user's company profile (404 if not found)."""
    return get_user_company_record(user_id)


def upsert_company(user_id: str, data: CompanyPayload) -> dict:
    """Creates company record on first save, updates if already exists."""
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM companies WHERE user_id = ?",
            (str(user_id),),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE companies
                SET name = ?,
                    website = ?,
                    industry = ?,
                    tagline = ?,
                    description = ?,
                    products_services = ?,
                    target_market = ?,
                    value_props = ?,
                    boilerplate = ?,
                    contact_info = ?,
                    default_language = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (
                    data.name,
                    data.website,
                    data.industry,
                    data.tagline,
                    data.description,
                    data.products_services,
                    data.target_market,
                    data.value_props,
                    data.boilerplate,
                    data.contact_info,
                    data.default_language,
                    str(user_id),
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO companies (
                    user_id,
                    name,
                    website,
                    industry,
                    tagline,
                    description,
                    products_services,
                    target_market,
                    value_props,
                    boilerplate,
                    contact_info,
                    default_language
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(user_id),
                    data.name,
                    data.website,
                    data.industry,
                    data.tagline,
                    data.description,
                    data.products_services,
                    data.target_market,
                    data.value_props,
                    data.boilerplate,
                    data.contact_info,
                    data.default_language,
                ),
            )

    return get_user_company_record(user_id)



# ── Projects Services ─────────────────────────────────────────────────────────

def list_projects(user_id: str) -> List[dict]:
    """Lists all projects for the user with content piece counts."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT p.*, COUNT(c.id) AS piece_count
            FROM projects p
            LEFT JOIN content_pieces c ON c.project_id = p.id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            """,
            (str(user_id),),
        ).fetchall()
    return [dict(r) for r in rows]


def create_project(user_id: str, data: ProjectCreate) -> dict:
    """Creates a new project for the authenticated user."""
    project_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO projects (id, user_id, name, description)
            VALUES (?, ?, ?, ?)
            """,
            (project_id, str(user_id), data.name.strip(), data.description.strip()),
        )
    return get_user_project_record(project_id, user_id)


def get_project(user_id: str, project_id: str) -> dict:
    """Retrieves a single project (404 if not found or unauthorized)."""
    return get_user_project_record(project_id, user_id)


def delete_project(user_id: str, project_id: str) -> None:
    """Deletes a project belonging to the user."""
    # Ensure it exists and user owns it (raises 404 otherwise)
    get_user_project_record(project_id, user_id)
    with get_db() as conn:
        conn.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (str(project_id), str(user_id)),
        )


# ── Content Pieces Services ───────────────────────────────────────────────────

def get_user_piece_record(piece_id: str, user_id: str) -> dict:
    """Retrieves single piece with user isolation (404 if not found or unauthorized)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM content_pieces WHERE id = ? AND user_id = ?",
            (str(piece_id), str(user_id)),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Content piece not found.")
    return dict(row)


def list_project_pieces(user_id: str, project_id: str) -> List[dict]:
    """Lists all content pieces belonging to a specific project for the user."""
    # Ensure project exists and belongs to the user
    get_user_project_record(project_id, user_id)
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM content_pieces
            WHERE project_id = ? AND user_id = ?
            ORDER BY updated_at DESC
            """,
            (str(project_id), str(user_id)),
        ).fetchall()
    return [dict(r) for r in rows]


def list_all_pieces(user_id: str, limit: int = 20) -> List[dict]:
    """Lists all content pieces for the user, including standalone ones."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.*, p.name AS project_name
            FROM content_pieces c
            LEFT JOIN projects p ON p.id = c.project_id
            WHERE c.user_id = ?
            ORDER BY c.updated_at DESC
            LIMIT ?
            """,
            (str(user_id), limit),
        ).fetchall()
    return [dict(r) for r in rows]


def create_piece(user_id: str, data: ContentPieceCreate) -> dict:
    """Creates a new content piece."""
    if data.project_id:
        get_user_project_record(data.project_id, user_id)

    piece_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO content_pieces (id, user_id, project_id, title, content_type, status, content, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                piece_id,
                str(user_id),
                data.project_id,
                data.title.strip(),
                data.content_type.strip(),
                data.status.strip(),
                data.content,
                data.metadata,
            ),
        )
    return get_user_piece_record(piece_id, user_id)


def delete_piece(user_id: str, piece_id: str) -> None:
    """Deletes a content piece."""
    get_user_piece_record(piece_id, user_id)
    with get_db() as conn:
        conn.execute(
            "DELETE FROM content_pieces WHERE id = ? AND user_id = ?",
            (str(piece_id), str(user_id)),
        )


# ── Content Generation Services ───────────────────────────────────────────────

def generate_and_save_piece(user_id: str, data: GenerateContentRequest) -> dict:
    """
    Generates content using Groq LLM with company context and saves it to app.db.
    Selects fast model (20b) for social/email/ads and quality model (120b) for blogs/press.
    """
    # 1. Determine model mode
    quality_types = {"blog", "press_release"}
    mode = "quality" if data.content_type.lower() in quality_types else "fast"

    # 2. Build system prompt (including voice guidelines and company context)
    system_parts = [
        "You are an expert AI copywriter and content strategist.",
    ]

    # Inject specific brand voice guidelines if selected
    if getattr(data, "voice_id", None):
        try:
            voice = get_user_voice_record(data.voice_id, user_id)
            system_parts.append(f"Brand Voice Persona: {voice['name']}")
            if voice.get("description"):
                system_parts.append(f"Voice Description: {voice['description']}")
            if voice.get("tone_tags"):
                system_parts.append(f"Tone Attributes: {voice['tone_tags']}")
            if voice.get("rules"):
                system_parts.append(f"Writing Rules & Style Guidelines:\n{voice['rules']}")
            if voice.get("sample_quote"):
                system_parts.append(f"Example Phrasing / Quote to Emulate: \"{voice['sample_quote']}\"")
        except HTTPException:
            system_parts.append(f"Desired Tone: {data.tone}.")
    else:
        system_parts.append(f"Desired Tone: {data.tone}.")

    if data.include_company_context:
        try:
            company = get_user_company_record(user_id)
            context_bullets = []
            if company.get("name"):
                context_bullets.append(f"- Company Name: {company['name']}")
            if company.get("tagline"):
                context_bullets.append(f"- Tagline: {company['tagline']}")
            if company.get("industry"):
                context_bullets.append(f"- Industry: {company['industry']}")
            if company.get("products_services"):
                context_bullets.append(f"- Products/Services: {company['products_services']}")
            if company.get("target_market"):
                context_bullets.append(f"- Target Market: {company['target_market']}")
            if company.get("value_props"):
                context_bullets.append(f"- Value Propositions: {company['value_props']}")
            if company.get("boilerplate"):
                context_bullets.append(f"- Boilerplate: {company['boilerplate']}")

            if context_bullets:
                system_parts.append("\nCompany Background Context:\n" + "\n".join(context_bullets))
        except HTTPException:
            # User hasn't filled company profile yet — proceed without error
            pass

    system_prompt = "\n\n".join(system_parts)

    # 3. Format type-specific prompt instructions
    type_guides = {
        "blog": "Write a compelling, well-researched blog article formatted in GitHub-flavored Markdown with clear headings (H2, H3), key takeaways, and a conclusion.",
        "social": "Write 2-3 high-performing social media post variants (e.g. for LinkedIn and Twitter/X). Include strong hooks, scannable formatting, calls to action, and relevant hashtags.",
        "email": "Write an engaging email newsletter. Include 2-3 catchy subject line options, a personalized greeting, value-packed body paragraphs, and a clear call to action.",
        "press_release": "Write a formal press release following industry standards (FOR IMMEDIATE RELEASE, DATELINE, Headline, Subhead, Body paragraphs, and standard Boilerplate).",
        "ad_copy": "Write multiple high-converting ad copy options. Provide 3 headline variations, 2 primary text descriptions, and recommended call-to-action buttons.",
    }

    type_instruction = type_guides.get(
        data.content_type.lower(),
        "Write high-quality content based on the instructions provided."
    )

    full_prompt = (
        f"Format and Task: {type_instruction}\n\n"
        f"Title / Headline: {data.title}\n\n"
        f"Brief & Key Instructions:\n{data.prompt}\n\n"
        "Generate the complete copy now:"
    )

    # 4. Generate content with Groq
    generated_text = generate_content(
        prompt=full_prompt,
        system_prompt=system_prompt,
        mode=mode,
        temperature=0.7,
        max_tokens=2500 if mode == "quality" else 1200,
    )

    # 5. Save generated piece into content_pieces
    metadata_json = json.dumps({
        "tone": data.tone,
        "mode": mode,
        "model_used": "openai/gpt-oss-120b" if mode == "quality" else "openai/gpt-oss-20b",
        "include_company_context": data.include_company_context,
    })

    piece_data = ContentPieceCreate(
        project_id=data.project_id if data.project_id else None,
        title=data.title,
        content_type=data.content_type,
        status="draft",
        content=generated_text,
        metadata=metadata_json,
    )

    return create_piece(user_id, piece_data)


def update_piece(user_id: str, piece_id: str, data: ContentPieceUpdate) -> dict:
    """Updates title, content, or status of an existing content piece."""
    existing = get_user_piece_record(piece_id, user_id)

    new_title = data.title if data.title is not None else existing["title"]
    new_content = data.content if data.content is not None else existing["content"]
    new_status = data.status if data.status is not None else existing["status"]

    with get_db() as conn:
        conn.execute(
            """
            UPDATE content_pieces
            SET title = ?,
                content = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (new_title.strip(), new_content, new_status.strip(), str(piece_id), str(user_id)),
        )

    return get_user_piece_record(piece_id, user_id)


def repurpose_piece(user_id: str, piece_id: str, data: RepurposeRequest) -> dict:
    """
    Repurposes an existing piece into a new format using Groq's fast model.
    Optionally saves the result as a new content piece in the same project.
    """
    original = get_user_piece_record(piece_id, user_id)

    format_instructions = {
        "twitter_thread": (
            "Repurpose the following content into an engaging Twitter / X thread (4-6 tweets). "
            "Use '1/', '2/', etc. numbering, hook the reader in tweet 1, use clean spacing, and end with a call-to-action tweet."
        ),
        "linkedin_post": (
            "Repurpose the following content into a high-engagement LinkedIn post. "
            "Start with a strong one-line hook, use short scannable paragraphs, include key takeaways with bullet points, "
            "and end with an interactive question or call to action. Add 3-4 relevant hashtags."
        ),
        "tldr_summary": (
            "Repurpose the following content into a clear Executive Summary / TL;DR. "
            "Include: 1) One-sentence summary, 2) 3-5 key bullet takeaways, and 3) Recommended action."
        ),
        "email_teaser": (
            "Repurpose the following content into a punchy email newsletter teaser. "
            "Include 2 catchy subject line ideas, a conversational intro, a brief teaser of the core value, "
            "and a clear 'Read more' CTA."
        ),
    }

    instruction = format_instructions.get(
        data.target_format,
        "Repurpose the following content into the requested format clearly and concisely."
    )

    extra_instructions = f"\nSpecific Instructions: {data.instructions}" if data.instructions else ""

    prompt = (
        f"Task: {instruction}{extra_instructions}\n\n"
        f"Original Title: {original['title']}\n\n"
        f"Original Content:\n{original['content']}\n\n"
        "Generate the repurposed content now:"
    )

    repurposed_text = generate_content(
        prompt=prompt,
        system_prompt="You are an expert content repurposing specialist.",
        mode="fast",
        temperature=0.7,
        max_tokens=1500,
    )

    if data.save_as_new_piece:
        format_labels = {
            "twitter_thread": "Twitter Thread",
            "linkedin_post": "LinkedIn Post",
            "tldr_summary": "TL;DR Summary",
            "email_teaser": "Email Teaser",
        }
        label = format_labels.get(data.target_format, data.target_format.replace("_", " ").title())
        new_title = f"{original['title']} ({label})"

        new_piece_data = ContentPieceCreate(
            project_id=original.get("project_id"),
            title=new_title,
            content_type=data.target_format,
            status="draft",
            content=repurposed_text,
            metadata=json.dumps({
                "repurposed_from": piece_id,
                "target_format": data.target_format,
            }),
        )
        return create_piece(user_id, new_piece_data)

    return {
        "original_id": piece_id,
        "target_format": data.target_format,
        "repurposed_content": repurposed_text,
    }


# ── Brand Voices Services ─────────────────────────────────────────────────────

DEFAULT_BRAND_VOICES = [
  {
    "name": "Founder Bold",
    "description": "Visionary, direct, and thought-provoking. Speaks with conviction.",
    "tone_tags": "Visionary, Confident, Direct",
    "rules": "Keep sentences punchy and high-impact. State bold hypotheses. Avoid corporate jargon like 'synergy' or 'game-changing'. Use first-person plural ('We built this because...').",
    "sample_quote": "Most software adds friction. We set out to eliminate it entirely.",
  },
  {
    "name": "Technical Architect",
    "description": "Deeply knowledgeable, precise, and transparent about engineering trade-offs.",
    "tone_tags": "Authoritative, Precise, Data-Driven",
    "rules": "Focus on architecture, latency, and measurable outcomes. Cite exact mechanics rather than surface buzzwords. Respect the reader's technical acumen.",
    "sample_quote": "By caching at the edge, P99 latency dropped from 850ms to 42ms.",
  },
  {
    "name": "Friendly Conversational",
    "description": "Approachable, empathetic, and witty. Makes complex topics feel simple.",
    "tone_tags": "Warm, Relatable, Witty",
    "rules": "Write like you are talking to a smart friend over coffee. Use everyday analogies. Keep paragraphs short (1-2 sentences). Add light, tasteful humor when appropriate.",
    "sample_quote": "Think of it as having an extra senior copywriter on your team who never sleeps.",
  },
]


def seed_default_voices_if_needed(user_id: str) -> None:
    """Pre-populates a few high-quality default brand voices if the user has none."""
    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(id) FROM brand_voices WHERE user_id = ?",
            (str(user_id),),
        ).fetchone()[0]

        if count == 0:
            for v in DEFAULT_BRAND_VOICES:
                conn.execute(
                    """
                    INSERT INTO brand_voices (id, user_id, name, description, tone_tags, rules, sample_quote)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        str(user_id),
                        v["name"],
                        v["description"],
                        v["tone_tags"],
                        v["rules"],
                        v["sample_quote"],
                    ),
                )


def list_brand_voices(user_id: str) -> List[dict]:
    """Lists all brand voices for the user, seeding defaults on first load."""
    seed_default_voices_if_needed(user_id)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM brand_voices WHERE user_id = ? ORDER BY created_at ASC",
            (str(user_id),),
        ).fetchall()
    return [dict(r) for r in rows]


def create_brand_voice(user_id: str, data: BrandVoiceCreate) -> dict:
    """Creates a new custom brand voice."""
    voice_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO brand_voices (id, user_id, name, description, tone_tags, rules, sample_quote)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                voice_id,
                str(user_id),
                data.name.strip(),
                data.description.strip(),
                data.tone_tags.strip(),
                data.rules.strip(),
                data.sample_quote.strip(),
            ),
        )
    return get_user_voice_record(voice_id, user_id)


def update_brand_voice(user_id: str, voice_id: str, data: BrandVoiceUpdate) -> dict:
    """Updates an existing brand voice."""
    existing = get_user_voice_record(voice_id, user_id)

    name = data.name if data.name is not None else existing["name"]
    description = data.description if data.description is not None else existing["description"]
    tone_tags = data.tone_tags if data.tone_tags is not None else existing["tone_tags"]
    rules = data.rules if data.rules is not None else existing["rules"]
    sample_quote = data.sample_quote if data.sample_quote is not None else existing["sample_quote"]

    with get_db() as conn:
        conn.execute(
            """
            UPDATE brand_voices
            SET name = ?,
                description = ?,
                tone_tags = ?,
                rules = ?,
                sample_quote = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
            """,
            (
                name.strip(),
                description.strip(),
                tone_tags.strip(),
                rules.strip(),
                sample_quote.strip(),
                str(voice_id),
                str(user_id),
            ),
        )
    return get_user_voice_record(voice_id, user_id)


def delete_brand_voice(user_id: str, voice_id: str) -> None:
    """Deletes a brand voice."""
    get_user_voice_record(voice_id, user_id)
    with get_db() as conn:
        conn.execute(
            "DELETE FROM brand_voices WHERE id = ? AND user_id = ?",
            (str(voice_id), str(user_id)),
        )
