"""
Standalone Pipeline Test for AI Document Processing & OCR.
Generates a realistic tilted sample invoice image, then executes:
Preprocess (OpenCV deskew) -> OCR (EasyOCR) -> Classify (Gemini) -> Extract (Gemini) -> Dual Merge & Bbox Annotation.
"""

import os
import sys
import time
import json
from pathlib import Path

# Force UTF-8 encoding on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Add backend directory to sys.path so imports work
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from ocr.services.image_preprocessor import ImagePreprocessor
from ocr.services.ocr_engine import OCREngine
from ocr.services.vision_extractor import VisionExtractor
from ocr.services.dual_merger import DualMerger
from ocr.services.bbox_renderer import BBoxRenderer
from ocr.services.export_service import ExportService


def create_sample_invoice(output_path: Path) -> Path:
    """Creates a realistic invoice image and tilts it by 3 degrees to test deskewing."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 800 x 1050 white paper
    w, h = 800, 1050
    img = Image.new("RGB", (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Header / Vendor
    draw.text((60, 50), "ACME SUPPLIES PVT LTD", fill=(15, 23, 42))
    draw.text((60, 75), "Plot 14, Sector 62, Noida, UP 201309", fill=(100, 116, 139))
    draw.text((60, 95), "GSTIN: 07AAAAA0000A1Z5", fill=(100, 116, 139))

    # Right header: INVOICE
    draw.text((580, 50), "INVOICE", fill=(15, 23, 42))
    draw.text((520, 85), "Invoice #: INV-2041", fill=(15, 23, 42))
    draw.text((520, 110), "Date: 12 Oct 2026", fill=(15, 23, 42))
    draw.text((520, 135), "Due Date: 11 Nov 2026", fill=(15, 23, 42))

    # Divider
    draw.line([(60, 170), (740, 170)], fill=(226, 232, 240), width=2)

    # Bill To
    draw.text((60, 190), "BILL TO:", fill=(100, 116, 139))
    draw.text((60, 215), "Nexa Digital LLP", fill=(15, 23, 42))
    draw.text((60, 235), "4th Floor, Tech Park, Gurugram, HR", fill=(100, 116, 139))

    # Table Header
    y_table = 290
    draw.rectangle([60, y_table, 740, y_table + 32], fill=(241, 245, 249))
    draw.text((70, y_table + 8), "Description", fill=(15, 23, 42))
    draw.text((360, y_table + 8), "Qty", fill=(15, 23, 42))
    draw.text((470, y_table + 8), "Unit Price", fill=(15, 23, 42))
    draw.text((640, y_table + 8), "Amount", fill=(15, 23, 42))

    # Table Rows
    rows = [
        ("A4 Paper Ream (75 GSM)", "20", "450.00", "9,000.00"),
        ("Printer Toner Black Pro", "6", "4,200.00", "25,200.00"),
        ("Heavy Duty Stapler Pro", "10", "650.00", "6,500.00"),
    ]

    curr_y = y_table + 45
    for desc, qty, price, amt in rows:
        draw.text((70, curr_y), desc, fill=(30, 41, 59))
        draw.text((370, curr_y), qty, fill=(30, 41, 59))
        draw.text((480, curr_y), price, fill=(30, 41, 59))
        draw.text((640, curr_y), amt, fill=(30, 41, 59))
        draw.line([(60, curr_y + 25), (740, curr_y + 25)], fill=(241, 245, 249), width=1)
        curr_y += 35

    # Totals block
    t_y = curr_y + 30
    draw.text((480, t_y), "Subtotal:", fill=(100, 116, 139))
    draw.text((640, t_y), "40,700.00", fill=(15, 23, 42))

    draw.text((480, t_y + 25), "Tax (GST 18%):", fill=(100, 116, 139))
    draw.text((640, t_y + 25), "7,326.00", fill=(15, 23, 42))

    draw.line([(480, t_y + 55), (740, t_y + 55)], fill=(203, 213, 225), width=2)
    draw.text((480, t_y + 65), "Total:", fill=(15, 23, 42))
    draw.text((630, t_y + 65), "INR 48,026.00", fill=(15, 23, 42))

    # Footer
    draw.text((60, 950), "Payment terms: Net 30 days", fill=(148, 163, 184))
    draw.text((60, 970), "Bank: HDFC Bank · A/C ending 4417 · IFSC: HDFC0001234", fill=(148, 163, 184))

    # Now intentionally rotate by -3.2 degrees to simulate a skewed scan/phone photo
    rotated = img.rotate(-3.2, expand=True, fillcolor=(245, 245, 245))
    rotated.save(output_path, "JPEG", quality=95)
    print(f"[Sample Created] Saved realistic tilted invoice to {output_path}")
    return output_path


def run_test():
    print("=" * 65)
    print("AI DOCUMENT PROCESSING & OCR PIPELINE - STANDALONE TEST")
    print("=" * 65)

    sample_path = BACKEND_DIR.parent / "sample_documents" / "invoices" / "sample_invoice_tilted.jpg"
    create_sample_invoice(sample_path)

    # 1. PREPROCESSING
    t0 = time.time()
    preprocessed_img, prep_meta = ImagePreprocessor.preprocess(
        str(sample_path),
        do_deskew=True,
        do_denoise=True,
        do_clahe=True,
    )
    t_prep = round(time.time() - t0, 2)
    print(f"\n[1. Preprocessing] Done in {t_prep}s")
    print(f"    - Detected Skew Angle: {prep_meta['skew_angle']}°")
    print(f"    - Auto-Deskewed: {prep_meta['deskewed']}")
    print(f"    - Denoised: {prep_meta['denoised']}, CLAHE: {prep_meta['clahe_applied']}")

    prep_jpeg = ImagePreprocessor.to_jpeg_bytes(preprocessed_img)

    # 2. OCR EXTRACTION (EasyOCR)
    t0 = time.time()
    ocr_result = OCREngine.extract_tokens(preprocessed_img)
    t_ocr = round(time.time() - t0, 2)
    print(f"\n[2. OCR Engine] Done in {t_ocr}s")
    print(f"    - Extracted Tokens: {ocr_result['token_count']}")
    print(f"    - Sample Tokens:")
    for tok in ocr_result["tokens"][:5]:
        print(f"       * {tok['text']} (conf: {tok['confidence']}, box: {tok['bbox_norm']})")

    # 3. CLASSIFICATION (Gemini Vision)
    t0 = time.time()
    vision_extractor = VisionExtractor()
    classify_result = vision_extractor.classify_document(prep_jpeg)
    t_classify = round(time.time() - t0, 2)
    doc_type = classify_result.get("document_type", "Invoice")
    doc_conf = int(classify_result.get("confidence", 0.95) * 100)
    print(f"\n[3. Classification] Done in {t_classify}s")
    print(f"    - Detected Type: {doc_type} ({doc_conf}%)")
    print(f"    - Reason: {classify_result.get('explanation')}")

    # 4. STRUCTURED EXTRACTION (Gemini Vision)
    t0 = time.time()
    schema_path = BACKEND_DIR / "ocr" / "schemas" / "invoice.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    extracted_data = vision_extractor.extract_structured_data(
        image_bytes=prep_jpeg,
        document_type=doc_type,
        schema=schema,
        ocr_text=ocr_result["full_text"],
    )
    t_extract = round(time.time() - t0, 2)
    print(f"\n[4. Structured Extraction] Done in {t_extract}s")
    print(f"    - Extracted Fields: {list(extracted_data.get('fields', {}).keys())}")
    if extracted_data.get("table", {}).get("rows"):
        print(f"    - Extracted Line Items: {len(extracted_data['table']['rows'])} rows")

    # 5. DUAL MERGER (Reconcile OCR Bboxes + LLM Fields)
    t0 = time.time()
    merged = DualMerger.merge(
        schema=schema,
        extracted_fields=extracted_data.get("fields", {}),
        field_confidences=extracted_data.get("field_confidences", {}),
        ocr_tokens=ocr_result["tokens"],
        table_data=extracted_data.get("table"),
    )
    t_merge = round(time.time() - t0, 2)
    print(f"\n[5. Dual Merger] Done in {t_merge}s")
    print(f"    - Overall Confidence: {merged['overall_confidence']}%")
    print(f"    - Needs Review: {merged['needs_review_count']}")

    print("\n" + "-" * 40)
    print("FINAL EXTRACTED FIELDS & BOUNDING BOXES:")
    for f in merged["fields"]:
        bbox_str = f"{f['bbox_norm']}" if f['bbox_norm'] else "Not mapped"
        discrepancy = f" [{f['discrepancy']}]" if f.get("discrepancy") else ""
        print(f"  {f['category']:<8} | {f['label']:<15} : {f['value']:<25} | {f['confidence_level']} {f['confidence_pct']}%{discrepancy}")

    if merged.get("table") and merged["table"].get("rows"):
        print("\nLINE ITEMS TABLE:")
        for r in merged["table"]["rows"]:
            print(f"  {r}")

    # 6. RENDER ANNOTATED IMAGE
    annotated_bytes = BBoxRenderer.render_annotated_image(
        image_bytes=prep_jpeg,
        fields=merged["fields"],
        table_bbox=merged.get("table_bbox"),
        selected_field_name="total_amount",
    )
    annotated_out = BACKEND_DIR.parent / "sample_documents" / "invoices" / "sample_annotated_output.jpg"
    with open(annotated_out, "wb") as f:
        f.write(annotated_bytes)
    print(f"\n[Annotated Image] Saved with colored bounding boxes to: {annotated_out}")

    # 7. EXPORT TEST
    csv_out = ExportService.to_csv(merged["fields"], merged.get("table"))
    excel_bytes = ExportService.to_excel("sample_invoice", doc_type, merged["fields"], merged.get("table"))
    excel_out = BACKEND_DIR.parent / "sample_documents" / "invoices" / "sample_export.xlsx"
    with open(excel_out, "wb") as f:
        f.write(excel_bytes)
    print(f"[Export] Generated CSV and Excel workbook saved to: {excel_out}")

    print("\n" + "=" * 65)
    print("TIMELINE BREAKDOWN (Matching Your Preview Bar!):")
    print(f"  ✓ Preprocess {t_prep}s  ─  ✓ OCR {t_ocr}s  ─  ✓ Classify {t_classify}s  ─  ✓ Extract {t_extract}s  ─  ✓ Merge {t_merge}s")
    print(f"  Overall Confidence: {merged['overall_confidence']}%")
    print("=" * 65)


if __name__ == "__main__":
    run_test()
