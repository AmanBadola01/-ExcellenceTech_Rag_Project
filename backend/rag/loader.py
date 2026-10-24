"""
STEP 1: DOCUMENT LOADING
------------------------
Reads a TXT or PDF file and returns its full text as one string.
"""

import os
from pypdf import PdfReader


def load_document(file_path: str) -> str:
    """Load text from a .txt or .pdf file."""

    # It make sure the file actually exists before trying to read it
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Get the file extension (".txt" or ".pdf") in lowercase
    extension = os.path.splitext(file_path)[1].lower()

    if extension == ".txt":
        # This is reading everything in the file
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()

    elif extension == ".pdf":
        # PDF file: read page by page and join the text of all pages
        reader = PdfReader(file_path)
        pages_text = []
        for page in reader.pages:
            # extract_text() can return None for image-only pages, so fall back to ""
            pages_text.append(page.extract_text() or "")
        text = "\n".join(pages_text)

    else:
        raise ValueError("Unsupported file type. Please use a .txt or .pdf file.")

    # It stop if the file is not readable example: a scanned PDF file
    if not text.strip():
        raise ValueError("No text could be extracted from the document.")

    return text
