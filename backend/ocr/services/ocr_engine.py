"""
OCR Engine Service using EasyOCR (with PyTesseract fallback).
Extracts raw text tokens, confidence scores, and normalized bounding box coordinates.
"""

import os
import sys
import time
from typing import List, Dict, Any, Optional
import numpy as np
import cv2

# Ensure UTF-8 output encoding on Windows consoles
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"

# Lazy loaded EasyOCR reader
_easyocr_reader = None


def get_easyocr_reader(lang_list: Optional[List[str]] = None):
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        langs = lang_list or ["en"]
        # Use GPU if available, else CPU, verbose=False prevents Windows console encoding errors
        _easyocr_reader = easyocr.Reader(langs, gpu=False, verbose=False)
    return _easyocr_reader


class OCREngine:
    @classmethod
    def extract_tokens(
        cls,
        image: np.ndarray,
        languages: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Runs OCR on the given image.
        Returns:
            tokens: List of dicts with text, confidence, bbox [x1, y1, x2, y2], and bbox_pct [ymin%, xmin%, ymax%, xmax%]
            full_text: concatenated string of all text lines
            duration: time taken in seconds
        """
        start_time = time.time()
        h, w = image.shape[:2]

        tokens = []
        full_text_lines = []

        try:
            reader = get_easyocr_reader(languages)
            results = reader.readtext(image)

            for bbox, text, conf in results:
                text_clean = text.strip()
                if not text_clean:
                    continue

                full_text_lines.append(text_clean)

                # EasyOCR returns 4 corner points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
                pts = np.array(bbox, dtype=np.int32)
                x_min = int(np.min(pts[:, 0]))
                x_max = int(np.max(pts[:, 0]))
                y_min = int(np.min(pts[:, 1]))
                y_max = int(np.max(pts[:, 1]))

                # Clamp within image bounds
                x_min = max(0, min(x_min, w))
                x_max = max(0, min(x_max, w))
                y_min = max(0, min(y_min, h))
                y_max = max(0, min(y_max, h))

                # Normalized percentages (0.0 to 100.0) for responsive web display
                ymin_pct = round((y_min / h) * 100, 2)
                xmin_pct = round((x_min / w) * 100, 2)
                ymax_pct = round((y_max / h) * 100, 2)
                xmax_pct = round((x_max / w) * 100, 2)

                tokens.append({
                    "text": text_clean,
                    "confidence": round(float(conf), 3),
                    "bbox": [x_min, y_min, x_max, y_max],
                    "bbox_norm": [ymin_pct, xmin_pct, ymax_pct, xmax_pct],
                })

        except Exception as e:
            # Fallback to pytesseract if EasyOCR throws
            import pytesseract
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            data = pytesseract.image_to_data(rgb, output_type=pytesseract.Output.DICT)
            n_boxes = len(data["text"])
            for i in range(n_boxes):
                txt = data["text"][i].strip()
                conf_val = float(data["conf"][i])
                if not txt or conf_val < 0:
                    continue

                full_text_lines.append(txt)
                x = data["left"][i]
                y = data["top"][i]
                bw = data["width"][i]
                bh = data["height"][i]

                x_min = max(0, min(x, w))
                y_min = max(0, min(y, h))
                x_max = max(0, min(x + bw, w))
                y_max = max(0, min(y + bh, h))

                tokens.append({
                    "text": txt,
                    "confidence": round(conf_val / 100.0, 3),
                    "bbox": [x_min, y_min, x_max, y_max],
                    "bbox_norm": [
                        round((y_min / h) * 100, 2),
                        round((x_min / w) * 100, 2),
                        round((y_max / h) * 100, 2),
                        round((x_max / w) * 100, 2),
                    ],
                })

        duration = round(time.time() - start_time, 2)
        return {
            "tokens": tokens,
            "full_text": "\n".join(full_text_lines),
            "token_count": len(tokens),
            "duration": duration,
        }
