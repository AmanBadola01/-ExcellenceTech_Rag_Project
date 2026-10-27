"""
Groq LLM helper for AI Content Studio.
Optimized for Groq free-tier rate limits:
- Fast task mode: llama-3.1-8b-instant (high TPM/RPM, sub-second latency)
- Quality task mode: llama-3.3-70b-versatile (long-form articles, deep synthesis) with fallback
"""

import logging
from typing import Optional, List, Dict, Any
from groq import Groq, RateLimitError
from core.config import GROQ_API_KEY, GROQ_MODEL_FAST, GROQ_MODEL_QUALITY

logger = logging.getLogger(__name__)

_groq_client: Optional[Groq] = None


def get_groq_client() -> Groq:
    """Returns singleton Groq client instance."""
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY is not configured in environment or .env file."
            )
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def generate_content(
    prompt: str,
    system_prompt: Optional[str] = None,
    mode: str = "fast",
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> str:
    """
    Generate content with Groq.
    
    :param prompt: User prompt / instructions.
    :param system_prompt: Optional brand tone / persona instructions.
    :param mode: 'fast' (llama-3.1-8b-instant) or 'quality' (llama-3.3-70b-versatile).
    :param temperature: Creativity scale (0.0 to 1.0).
    :param max_tokens: Max tokens to generate.
    :return: Generated text string.
    """
    client = get_groq_client()
    
    primary_model = GROQ_MODEL_QUALITY if mode == "quality" else GROQ_MODEL_FAST
    fallback_model = GROQ_MODEL_FAST

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        response = client.chat.completions.create(
            model=primary_model,
            messages=messages, # type: ignore
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except RateLimitError as e:
        logger.warning(
            f"Groq rate limit hit on model '{primary_model}'. Attempting fallback to '{fallback_model}'. Error: {e}"
        )
        if primary_model != fallback_model:
            response = client.chat.completions.create(
                model=fallback_model,
                messages=messages, # type: ignore
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        raise

