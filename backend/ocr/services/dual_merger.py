"""
Dual Merger Service.
Reconciles EasyOCR bounding boxes and raw tokens with Gemini Vision structured fields.
Detects OCR vs LLM discrepancies, assigns category colors, and calculates overall confidence.
"""

from typing import List, Dict, Any, Optional
import re
import difflib


class DualMerger:
    @staticmethod
    def _clean_str(s: Any) -> str:
        if s is None:
            return ""
        return str(s).strip().lower()

    @classmethod
    def find_best_bbox_for_value(
        cls,
        target_value: str,
        ocr_tokens: List[Dict[str, Any]],
    ) -> Optional[List[float]]:
        """
        Finds the bounding box [ymin_pct, xmin_pct, ymax_pct, xmax_pct] in ocr_tokens
        that best matches target_value.
        """
        if not target_value:
            return None

        val_clean = cls._clean_str(target_value)
        # Remove currency symbols and punctuation for matching numbers
        val_alphanumeric = re.sub(r"[^\w\s]", "", val_clean).strip()

        best_box = None
        best_score = 0.0

        # 1. Check exact or strong token match
        for tok in ocr_tokens:
            tok_clean = cls._clean_str(tok["text"])
            tok_alphanumeric = re.sub(r"[^\w\s]", "", tok_clean).strip()

            if val_clean in tok_clean or tok_clean in val_clean:
                return tok["bbox_norm"]

            if val_alphanumeric and (val_alphanumeric in tok_alphanumeric or tok_alphanumeric in val_alphanumeric):
                return tok["bbox_norm"]

            # Fuzzy similarity
            ratio = difflib.SequenceMatcher(None, val_clean, tok_clean).ratio()
            if ratio > best_score:
                best_score = ratio
                best_box = tok["bbox_norm"]

        if best_score > 0.6:
            return best_box

        # 2. Check multi-token sequence match (for phrases like "Acme Supplies Pvt Ltd")
        val_words = val_clean.split()
        if len(val_words) > 1:
            matched_boxes = []
            for word in val_words:
                if len(word) < 2:
                    continue
                for tok in ocr_tokens:
                    if word in cls._clean_str(tok["text"]):
                        matched_boxes.append(tok["bbox_norm"])
                        break

            if matched_boxes:
                # Union of matched bounding boxes
                ymin = min(b[0] for b in matched_boxes)
                xmin = min(b[1] for b in matched_boxes)
                ymax = max(b[2] for b in matched_boxes)
                xmax = max(b[3] for b in matched_boxes)
                return [ymin, xmin, ymax, xmax]

        return None

    @classmethod
    def check_discrepancy(cls, field_name: str, value: Any, ocr_tokens: List[Dict[str, Any]]) -> Optional[str]:
        """
        Checks if OCR token reading differs from LLM extracted value (especially for totals and numbers).
        Returns discrepancy string like 'OCR 48,026 vs LLM 48,028' if detected.
        """
        if not value:
            return None

        # Extract digits/amounts
        val_str = str(value)
        val_num_match = re.search(r"[\d,]+(?:\.\d+)?", val_str)
        if not val_num_match:
            return None

        val_num = val_num_match.group(0).replace(",", "")
        
        # Look for nearby numbers in OCR tokens
        for tok in ocr_tokens:
            tok_text = tok["text"].replace(",", "")
            tok_num_match = re.search(r"[\d]+(?:\.\d+)?", tok_text)
            if tok_num_match:
                tok_num = tok_num_match.group(0)
                # If they are very close in value or length but have slight digit divergence
                if (
                    len(tok_num) == len(val_num)
                    and tok_num != val_num
                    and ("total" in field_name.lower() or "amount" in field_name.lower() or "price" in field_name.lower())
                ):
                    diff_chars = sum(c1 != c2 for c1, c2 in zip(tok_num, val_num))
                    if diff_chars == 1:
                        return f"OCR {tok_num} vs LLM {val_num}"

        return None

    @classmethod
    def merge(
        cls,
        schema: Dict[str, Any],
        extracted_fields: Dict[str, Any],
        field_confidences: Dict[str, float],
        ocr_tokens: List[Dict[str, Any]],
        table_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Merges schema metadata, LLM fields, and OCR bounding boxes into the final review structure.
        """
        fields_schema = {f["name"]: f for f in schema.get("fields", [])}

        merged_fields = []
        high_conf_count = 0
        total_conf_sum = 0.0
        needs_review_count = 0

        for field_name, value in extracted_fields.items():
            meta = fields_schema.get(field_name, {
                "label": field_name.replace("_", " ").title(),
                "category": "Names",
                "color": "#f97316",
            })

            conf_val = float(field_confidences.get(field_name, 0.85))
            total_conf_sum += conf_val

            # Determine badge level
            if conf_val >= 0.85:
                level = "High"
                high_conf_count += 1
            elif conf_val >= 0.70:
                level = "Medium"
            else:
                level = "Low"
                needs_review_count += 1

            # Match bounding box
            val_str = str(value) if value is not None else ""
            bbox_norm = cls.find_best_bbox_for_value(val_str, ocr_tokens)

            # Check OCR vs LLM discrepancy
            discrepancy = cls.check_discrepancy(field_name, val_str, ocr_tokens)
            if discrepancy:
                # If discrepancy found, lower confidence slightly to flag for review
                level = "Low"
                conf_val = min(conf_val, 0.58)
                needs_review_count += 1

            merged_fields.append({
                "name": field_name,
                "label": meta.get("label", field_name),
                "value": val_str,
                "category": meta.get("category", "Names"),
                "color": meta.get("color", "#f97316"),
                "confidence": round(conf_val, 2),
                "confidence_level": level,
                "confidence_pct": int(conf_val * 100),
                "bbox_norm": bbox_norm,
                "discrepancy": discrepancy,
            })

        field_count = len(merged_fields) or 1
        overall_confidence_pct = int((total_conf_sum / field_count) * 100)

        # Detect table boundary bbox if rows exist
        table_bbox = None
        if table_data and table_data.get("rows"):
            matched_cells = []
            for row in table_data["rows"]:
                for _, cell_val in row.items():
                    b = cls.find_best_bbox_for_value(str(cell_val), ocr_tokens)
                    if b:
                        matched_cells.append(b)
            if matched_cells:
                table_bbox = [
                    max(0, min(b[0] for b in matched_cells) - 2),
                    max(0, min(b[1] for b in matched_cells) - 2),
                    min(100, max(b[2] for b in matched_cells) + 2),
                    min(100, max(b[3] for b in matched_cells) + 2),
                ]

        return {
            "fields": merged_fields,
            "overall_confidence": overall_confidence_pct,
            "needs_review_count": needs_review_count,
            "table": table_data,
            "table_bbox": table_bbox,
        }

