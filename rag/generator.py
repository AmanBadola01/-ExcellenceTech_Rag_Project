"""
STEP 6: ANSWER GENERATION
-------------------------
Sends the retrieved chunks + the user's question to an LLM and gets an answer.

Hallucination control happens here through:
1. A strict prompt: "answer ONLY from the context, otherwise say you don't know"
2. temperature = 0, so the model doesn't get "creative"
"""

import os
from typing import List

# The message that will be shown when model can not find the answer. 
NOT_FOUND_MESSAGE = "I couldn't find this information in the document."

# System prompt that will be sent to LLM
PROMPT_TEMPLATE = """You are a question-answering assistant.
Answer the question using ONLY the information in the context below.

Rules:
- If the answer is in the context, answer clearly and concisely.
- If the answer is NOT in the context, reply exactly: "{not_found}"
- Do not use any outside knowledge. Do not guess.

# Chunk that will be retrived 
Context:
{context}

#Question that will be asked by the user.
Question: {question}

Answer:"""


def build_prompt(question: str, chunks: List[str]) -> str:
    """Join the retrieved chunks and insert them, with the question, into the prompt."""
    context = "\n\n---\n\n".join(chunks)  # "---" separates chunks so the LLM sees boundaries
    return PROMPT_TEMPLATE.format(not_found=NOT_FOUND_MESSAGE, context=context, question=question)


class Generator:
    def __init__(self):
        # Read which LLM to use from environment variables (.env file)
        self.provider = os.getenv("LLM_PROVIDER", "gemini").lower()

        if self.provider == "gemini":   
            from google import genai

            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise EnvironmentError("GEMINI_API_KEY is missing. Add it to your .env file.")
            self.client = genai.Client(api_key=api_key)
            self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        elif self.provider == "openai":
            from openai import OpenAI

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise EnvironmentError("OPENAI_API_KEY is missing. Add it to your .env file.")
            self.client = OpenAI(api_key=api_key)
            self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        # If no LLM credentials match 
        else:
            raise ValueError("LLM_PROVIDER must be 'gemini' or 'openai'.")

        print(f"[Generator] Using {self.provider} model: {self.model}")

    def generate(self, question: str, chunks: List[str]) -> str:
        """Ask the LLM to answer the question using only the given chunks."""
        prompt = build_prompt(question, chunks)

        if self.provider == "gemini":
            from google.genai import types

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0 ),
            )
            return (response.text or "").strip()

        # OpenAI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return response.choices[0].message.content.strip()
