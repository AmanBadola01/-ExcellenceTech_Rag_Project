"""
Vision LLM Extractor Service using Google Gemini Vision (google-genai SDK).
Performs:
1. Auto-Classification of Document Type with confidence score.
2. Structured Schema-Specific Extraction (fields, confidence, line items tables).
"""

import os
import json
import time
from typing import Dict, Any, Optional, Tuple
from PIL import Image
import io

from core.config import GEMINI_API_KEY, GEMINI_MODEL


class VisionExtractor:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        if not self.api_key:
            print("[VisionExtractor] Warning: GEMINI_API_KEY is not set.")
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured.")
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def classify_document(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Classifies document into supported types:
        Invoice, Receipt, Business Card, Form, ID Card, Contract, Report, Handwritten Note, Whiteboard, Other.
        """
        start_time = time.time()
        client = self._get_client()

        prompt = """You are an expert document analysis AI.
Analyze this document image and classify it into EXACTLY ONE of the following categories:
- Invoice
- Receipt
- Business Card
- Form
- ID Card
- Contract
- Report
- Handwritten Note
- Whiteboard
- Other

Output ONLY valid JSON with this exact structure:
{
  "document_type": "Invoice",
  "confidence": 0.96,
  "explanation": "Brief 1-sentence reason why"
}
"""

        try:
            # Prepare image part
            from google.genai import types
            img_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

            response = client.models.generate_content(
                model=self.model,
                contents=[img_part, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                ),
            )

            text = response.text.strip()
            data = json.loads(text)
            data["duration"] = round(time.time() - start_time, 2)
            return data

        except Exception as e:
            # Fallback heuristic
            return {
                "document_type": "Invoice",
                "confidence": 0.70,
                "explanation": f"Fallback classification: {str(e)}",
                "duration": round(time.time() - start_time, 2),
            }

    def extract_structured_data(
        self,
        image_bytes: bytes,
        document_type: str,
        schema: Dict[str, Any],
        ocr_text: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extracts structured fields and tabular data according to the provided schema.
        """
        start_time = time.time()
        client = self._get_client()

        fields_meta = schema.get("fields", [])
        field_descriptions = "\n".join(
            [f"- {f['name']} ({f['label']}): required={f.get('required', False)}" for f in fields_meta]
        )

        table_meta = schema.get("table", {})
        table_prompt = ""
        if table_meta:
            table_prompt = f"""
Also extract any tabular data for '{table_meta.get('name', 'Table')}'.
Expected columns: {json.dumps(table_meta.get('columns', []))}.
Format table rows as a list of objects where each key is a column name.
"""

        prompt = f"""You are an intelligent document extraction engine.
Document Type: {document_type}

Extract the following target fields from this document image:
{field_descriptions}

{table_prompt}

Rules:
1. Extract exact text and numbers as printed on the document. Do not invent or summarize values.
2. For each extracted field, provide a confidence score between 0.0 and 1.0.
3. If a field is not present in the document, set its value to null.
4. If OCR raw text is helpful, here is reference OCR text:
'''
{ocr_text[:2000] if ocr_text else 'No OCR text'}
'''

Return ONLY valid JSON matching this schema:
{{
  "fields": {{
    "vendor_name": "...",
    "invoice_number": "...",
    "total_amount": "..."
  }},
  "field_confidences": {{
    "vendor_name": 0.98,
    "invoice_number": 0.97,
    "total_amount": 0.96
  }},
  "table": {{
    "name": "{table_meta.get('name', 'Table') if table_meta else 'None'}",
    "columns": {json.dumps(table_meta.get('columns', [])) if table_meta else '[]'},
    "rows": [
      {{"Description": "...", "Qty": "...", "Unit price": "...", "Amount": "..."}}
    ]
  }}
}}
"""

        try:
            from google.genai import types
            img_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

            response = client.models.generate_content(
                model=self.model,
                contents=[img_part, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    response_mime_type="application/json",
                ),
            )

            text = response.text.strip()
            data = json.loads(text)
            data["duration"] = round(time.time() - start_time, 2)
            return data

        except Exception as e:
            # Fallback basic extraction
            fallback_fields = {}
            fallback_conf = {}
            for f in fields_meta:
                fallback_fields[f["name"]] = None
                fallback_conf[f["name"]] = 0.5

            return {
                "fields": fallback_fields,
                "field_confidences": fallback_conf,
                "table": {"name": "Table", "columns": [], "rows": []},
                "error": str(e),
                "duration": round(time.time() - start_time, 2),
            }

