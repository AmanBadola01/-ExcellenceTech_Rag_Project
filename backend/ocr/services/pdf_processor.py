"""
PDF Processing Service using PyMuPDF (fitz).
Renders multi-page PDF documents into high-resolution images for OCR and preview.
"""

from typing import List, Dict, Any, Tuple
import pymupdf  # PyMuPDF
import io


class PDFProcessor:
    @staticmethod
    def is_pdf(file_bytes: bytes) -> bool:
        """Checks if file starts with PDF signature."""
        return file_bytes.startswith(b"%PDF-")

    @classmethod
    def render_pdf_pages(
        cls,
        pdf_bytes: bytes,
        dpi: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        Converts all pages in a PDF document into high-res JPEG image bytes.
        Returns:
            List of dicts: [{"page_number": 1, "image_bytes": b'...', "width": 1200, "height": 1600}]
        """
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        zoom = dpi / 72  # standard 72 pt/inch
        matrix = pymupdf.Matrix(zoom, zoom)

        for i in range(len(doc)):
            page = doc[i]
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img_bytes = pix.tobytes("jpeg")
            pages.append({
                "page_number": i + 1,
                "image_bytes": img_bytes,
                "width": pix.width,
                "height": pix.height,
            })

        doc.close()
        return pages

