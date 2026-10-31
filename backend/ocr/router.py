"""
FastAPI Router for AI Document Processing & OCR Pipeline.
Endpoints for Upload, Classification, Dual Extraction, Serving Images,
Updating Fields & Tables, Exporting (Excel/CSV/JSON), and Indexing to RAG.
"""

import os
import io
import time
import uuid
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
import jwt

from core.config import DATA_DIR, JWT_ALGORITHM, JWT_SECRET
from ocr.database import (
    delete_document,
    get_document,
    list_documents,
    save_document,
    save_fields_and_table,
    update_document_status,
    update_field_value,
    update_table_rows,
)
from ocr.services.bbox_renderer import BBoxRenderer
from ocr.services.dual_merger import DualMerger
from ocr.services.export_service import ExportService
from ocr.services.image_preprocessor import ImagePreprocessor
from ocr.services.ocr_engine import OCREngine
from ocr.services.pdf_processor import PDFProcessor
from ocr.services.vision_extractor import VisionExtractor

# Storage directories
UPLOAD_DIR = DATA_DIR / "ocr_uploads"
RAW_DIR = UPLOAD_DIR / "raw"
PREP_DIR = UPLOAD_DIR / "preprocessed"
ANNOT_DIR = UPLOAD_DIR / "annotated"
RAG_OCR_DIR = DATA_DIR / "ocr_rag_docs"

for d in [RAW_DIR, PREP_DIR, ANNOT_DIR, RAG_OCR_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Schema directory
SCHEMAS_DIR = Path(__file__).resolve().parent / "schemas"

router = APIRouter(tags=["ocr"])
optional_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
) -> Optional[Dict[str, Any]]:
    """Extracts user from Bearer token if provided, else None."""
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {"user_id": str(payload["sub"]), "email": payload.get("email")}
    except Exception:
        return None


def get_schema_for_type(document_type: str) -> Dict[str, Any]:
    """Loads matching JSON extraction schema for document type."""
    type_slug = document_type.lower().replace(" ", "_").replace("/", "_")
    schema_file = SCHEMAS_DIR / f"{type_slug}.json"
    if schema_file.exists():
        with open(schema_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Fallback to invoice schema if unknown
    fallback_file = SCHEMAS_DIR / "invoice.json"
    if fallback_file.exists():
        with open(fallback_file, "r", encoding="utf-8") as f:
            return json.load(f)

    return {"document_type": document_type, "fields": [], "table": None}


# ── Pydantic Request Models ────────────────────────────────────────────────

class FieldUpdateBody(BaseModel):
    field_name: Optional[str] = None
    value: Optional[str] = None
    corrected_value: Optional[str] = None
    is_verified: Optional[bool] = None


class TableUpdateBody(BaseModel):
    headers: Optional[List[str]] = None
    rows: Optional[List[Any]] = None


class StatusUpdateBody(BaseModel):
    status: str


class ApproveRagBody(BaseModel):
    doc_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    document_type: Optional[str] = Form(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Uploads document(s) (PDF, PNG, JPG).
    Saves raw file, renders first page image if PDF, and creates queued document record.
    Supports both single 'file' and batch 'files' parameters.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PREP_DIR.mkdir(parents=True, exist_ok=True)
    ANNOT_DIR.mkdir(parents=True, exist_ok=True)
    RAG_OCR_DIR.mkdir(parents=True, exist_ok=True)

    items_to_process: List[UploadFile] = []
    if files:
        items_to_process.extend([f for f in files if f and f.filename])
    elif file and file.filename:
        items_to_process.append(file)

    if not items_to_process:
        raise HTTPException(status_code=400, detail="No file provided for upload.")

    results = []
    for upload_item in items_to_process:
        content = await upload_item.read()
        if not content:
            if len(items_to_process) == 1:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            continue

        doc_id = str(uuid.uuid4())
        filename = upload_item.filename or f"upload_{doc_id[:8]}"
        content_type = upload_item.content_type or "application/octet-stream"
        is_pdf = PDFProcessor.is_pdf(content) or filename.lower().endswith(".pdf")

        ext = Path(filename).suffix or (".pdf" if is_pdf else ".jpg")
        raw_path = RAW_DIR / f"{doc_id}{ext}"
        with open(raw_path, "wb") as f:
            f.write(content)

        page_count = 1
        # If PDF, render the first page as the primary image for processing
        if is_pdf:
            pages = PDFProcessor.render_pdf_pages(content, dpi=180)
            page_count = len(pages)
            if pages:
                first_page_path = PREP_DIR / f"{doc_id}_p1.jpg"
                with open(first_page_path, "wb") as f:
                    f.write(pages[0]["image_bytes"])
                preprocessed_path = str(first_page_path)
            else:
                preprocessed_path = None
        else:
            preprocessed_path = None

        doc_record = {
            "id": doc_id,
            "user_id": user.get("user_id") if user and isinstance(user, dict) else None,
            "batch_id": None,
            "filename": filename,
            "file_type": "application/pdf" if is_pdf else content_type,
            "file_path": str(raw_path),
            "preprocessed_path": preprocessed_path,
            "annotated_path": None,
            "document_type": document_type or "Detecting...",
            "classification_confidence": 0.0,
            "overall_confidence": 0,
            "needs_review_count": 0,
            "status": "queued",
            "page_count": page_count,
            "t_preprocess": 0.0,
            "t_ocr": 0.0,
            "t_classify": 0.0,
            "t_extract": 0.0,
            "t_merge": 0.0,
            "raw_text": "",
            "error_message": None,
        }
        save_document(doc_record)
        results.append({
            "id": doc_id,
            "filename": filename,
            "file_type": doc_record["file_type"],
            "page_count": page_count,
            "status": "queued",
            "document_type": doc_record["document_type"],
        })

    if len(results) == 1 and not files:
        return results[0]
    return results


@router.post("/extract/{doc_id}")
async def process_and_extract(
    doc_id: str,
    override_type: Optional[str] = Form(None),
):
    """
    Runs the complete 5-stage pipeline:
    1. Preprocess (OpenCV deskew, denoise, CLAHE, binarize)
    2. OCR Engine (EasyOCR tokens + normalized bboxes)
    3. Classification (Gemini 3.8 Flash Vision)
    4. Structured Extraction (Gemini 3.8 Flash matching schema)
    5. Dual Merger (Reconcile coordinates, detect OCR vs LLM discrepancies)
    Saves annotated preview image and updates database.
    """
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    update_document_status(doc_id, "processing")

    try:
        # Determine source image bytes
        file_path = Path(doc["file_path"])
        if doc["file_type"] == "application/pdf" or file_path.suffix.lower() == ".pdf":
            with open(file_path, "rb") as f:
                pdf_bytes = f.read()
            pages = PDFProcessor.render_pdf_pages(pdf_bytes, dpi=200)
            if not pages:
                raise ValueError("Could not extract any pages from PDF.")
            input_bytes = pages[0]["image_bytes"]
        else:
            with open(file_path, "rb") as f:
                input_bytes = f.read()

        # ── 1. PREPROCESSING (OpenCV)
        t0 = time.time()
        preprocessed_img, prep_meta = ImagePreprocessor.preprocess(
            input_bytes,
            do_deskew=True,
            do_denoise=True,
            do_clahe=True,
        )
        t_preprocess = round(time.time() - t0, 2)
        prep_jpeg_bytes = ImagePreprocessor.to_jpeg_bytes(preprocessed_img)

        # Save preprocessed image file
        prep_img_path = PREP_DIR / f"{doc_id}_prep.jpg"
        with open(prep_img_path, "wb") as f:
            f.write(prep_jpeg_bytes)

        # ── 2. OCR ENGINE (EasyOCR)
        t0 = time.time()
        ocr_result = OCREngine.extract_tokens(preprocessed_img)
        t_ocr = round(time.time() - t0, 2)
        ocr_tokens = ocr_result["tokens"]
        raw_text = ocr_result["full_text"]

        # ── 3. CLASSIFICATION (Gemini Vision)
        t0 = time.time()
        vision_extractor = VisionExtractor()
        if override_type:
            doc_type = override_type
            class_conf = 1.0
        else:
            classify_res = vision_extractor.classify_document(prep_jpeg_bytes)
            doc_type = classify_res.get("document_type", "Invoice")
            class_conf = float(classify_res.get("confidence", 0.90))
        t_classify = round(time.time() - t0, 2)

        # ── 4. STRUCTURED EXTRACTION (Gemini Vision)
        t0 = time.time()
        schema = get_schema_for_type(doc_type)
        extracted = vision_extractor.extract_structured_data(
            image_bytes=prep_jpeg_bytes,
            document_type=doc_type,
            schema=schema,
            ocr_text=raw_text,
        )
        t_extract = round(time.time() - t0, 2)

        # ── 5. DUAL MERGER (Reconcile OCR Bboxes + LLM Values)
        t0 = time.time()
        merged = DualMerger.merge(
            schema=schema,
            extracted_fields=extracted.get("fields", {}),
            field_confidences=extracted.get("field_confidences", {}),
            ocr_tokens=ocr_tokens,
            table_data=extracted.get("table"),
        )
        t_merge = round(time.time() - t0, 2)

        # ── 6. RENDER ANNOTATED IMAGE (Pillow)
        annotated_bytes = BBoxRenderer.render_annotated_image(
            image_bytes=prep_jpeg_bytes,
            fields=merged["fields"],
            table_bbox=merged.get("table_bbox"),
        )
        annot_img_path = ANNOT_DIR / f"{doc_id}_annot.jpg"
        with open(annot_img_path, "wb") as f:
            f.write(annotated_bytes)

        # Save fields and table in database
        save_fields_and_table(
            doc_id=doc_id,
            fields=merged["fields"],
            table=merged.get("table"),
            table_bbox=merged.get("table_bbox"),
        )

        # Update document record
        final_status = "needs_review" if merged["needs_review_count"] > 0 else "approved"
        doc_record = {
            "id": doc_id,
            "user_id": doc.get("user_id"),
            "batch_id": doc.get("batch_id"),
            "filename": doc["filename"],
            "file_type": doc["file_type"],
            "file_path": doc["file_path"],
            "preprocessed_path": str(prep_img_path),
            "annotated_path": str(annot_img_path),
            "document_type": doc_type,
            "classification_confidence": class_conf,
            "overall_confidence": merged["overall_confidence"],
            "needs_review_count": merged["needs_review_count"],
            "status": final_status,
            "page_count": doc.get("page_count", 1),
            "t_preprocess": t_preprocess,
            "t_ocr": t_ocr,
            "t_classify": t_classify,
            "t_extract": t_extract,
            "t_merge": t_merge,
            "raw_text": raw_text,
            "error_message": None,
        }
        save_document(doc_record)

        return get_document_details(doc_id)

    except Exception as e:
        error_msg = str(e)
        save_document({
            "id": doc_id,
            "user_id": doc.get("user_id"),
            "batch_id": doc.get("batch_id"),
            "filename": doc["filename"],
            "file_type": doc["file_type"],
            "file_path": doc["file_path"],
            "preprocessed_path": doc.get("preprocessed_path"),
            "annotated_path": None,
            "document_type": doc.get("document_type") or "Unknown",
            "classification_confidence": 0.0,
            "overall_confidence": 0,
            "needs_review_count": 0,
            "status": "failed",
            "page_count": doc.get("page_count", 1),
            "t_preprocess": 0.0,
            "t_ocr": 0.0,
            "t_classify": 0.0,
            "t_extract": 0.0,
            "t_merge": 0.0,
            "raw_text": "",
            "error_message": error_msg,
        })
        raise HTTPException(status_code=500, detail=f"Extraction pipeline failed: {error_msg}")


@router.get("/documents")
def get_documents_list(
    search: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Lists recent documents with filtering, search, and normalized UI metadata."""
    user_id = user.get("user_id") if user else None
    docs = list_documents(user_id=user_id, search=search, doc_type=doc_type, status=status, limit=limit)
    for d in docs:
        d["num_pages"] = d.get("page_count", 1)
        d["confidence_score"] = (d.get("overall_confidence", 0) or 0) / 100.0
        d["is_approved_to_rag"] = d.get("status") == "approved"
        d["rotation_angle"] = d.get("rotation_angle", 0.0)
    return docs


@router.get("/documents/{doc_id}")
def get_document_details(doc_id: str):
    """Retrieves single document with all extracted fields and line items table, fully normalized."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Normalize fields for frontend ReviewDesk
    normalized_fields = []
    discrepancies = []
    for f in doc.get("fields", []):
        field_dict = dict(f)
        f_name = f.get("field_name") or f.get("name") or ""
        field_dict["field_key"] = f_name
        field_dict["field_value"] = f.get("value")
        field_dict["corrected_value"] = f.get("corrected_value") or f.get("value")
        field_dict["confidence"] = f.get("confidence", 0) or 0
        field_dict["bbox"] = f.get("bbox_norm")
        if f.get("discrepancy"):
            field_dict["is_discrepancy"] = True
            discrepancies.append({
                "field_key": f_name,
                "ocr_value": f.get("ocr_raw_value") or f.get("value") or "",
                "vision_value": f.get("vision_raw_value") or f.get("discrepancy") or "",
                "confidence": field_dict["confidence"],
            })
        normalized_fields.append(field_dict)
    doc["fields"] = normalized_fields
    doc["discrepancies"] = discrepancies

    # Normalize tables
    if doc.get("table"):
        tbl = doc["table"]
        columns = tbl.get("columns", [])
        raw_rows = tbl.get("rows", [])
        matrix_rows = []
        for r in raw_rows:
            if isinstance(r, dict):
                matrix_rows.append([str(r.get(c, "")) for c in columns])
            elif isinstance(r, list):
                matrix_rows.append([str(cell) for cell in r])
            else:
                matrix_rows.append([str(r)])
        doc["tables"] = [{
            "table_index": 0,
            "headers": columns,
            "rows": matrix_rows,
            "confidence": 0.95,
        }]
    else:
        doc["tables"] = []

    # Normalize summary props
    doc["num_pages"] = doc.get("page_count", 1)
    doc["confidence_score"] = (doc.get("overall_confidence", 0) or 0) / 100.0
    doc["is_approved_to_rag"] = doc.get("status") == "approved"
    doc["rotation_angle"] = doc.get("rotation_angle", 0.0)
    doc["metrics"] = {
        "preprocess_sec": doc.get("t_preprocess", 0.0),
        "ocr_sec": doc.get("t_ocr", 0.0),
        "vision_sec": doc.get("t_extract", 0.0),
        "reconcile_sec": doc.get("t_merge", 0.0),
        "total_sec": sum([
            doc.get("t_preprocess", 0.0),
            doc.get("t_ocr", 0.0),
            doc.get("t_classify", 0.0),
            doc.get("t_extract", 0.0),
            doc.get("t_merge", 0.0),
        ]),
    }
    return doc


@router.get("/documents/{doc_id}/image")
@router.get("/image/{doc_id}")
def get_document_image(doc_id: str, page_num: int = Query(1), token: Optional[str] = Query(None)):
    """Serves the deskewed/preprocessed document JPEG image."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Return preprocessed image if available, else raw
    if doc.get("preprocessed_path") and os.path.exists(doc["preprocessed_path"]):
        return FileResponse(doc["preprocessed_path"], media_type="image/jpeg")
    if doc.get("file_path") and os.path.exists(doc["file_path"]):
        return FileResponse(doc["file_path"])

    raise HTTPException(status_code=404, detail="Image file not found on disk.")


@router.get("/documents/{doc_id}/annotated")
@router.get("/annotated/{doc_id}")
def get_annotated_image(doc_id: str, page_num: int = Query(1), token: Optional[str] = Query(None)):
    """Serves the image with rendered bounding boxes."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.get("annotated_path") and os.path.exists(doc["annotated_path"]):
        return FileResponse(doc["annotated_path"], media_type="image/jpeg")

    # Fallback to preprocessed image if annotated not yet rendered
    return get_document_image(doc_id)


@router.put("/documents/{doc_id}/fields")
@router.put("/fields/{doc_id}/{field_key}")
def update_field(
    doc_id: str,
    field_key: Optional[str] = None,
    body: Optional[FieldUpdateBody] = None,
):
    """Saves user inline corrections to a field (supports both body and path field_key)."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    target_name = (body.field_name if body and body.field_name else field_key) or ""
    new_val = (
        body.corrected_value
        if body and body.corrected_value is not None
        else (body.value if body and body.value is not None else "")
    )
    update_field_value(doc_id, target_name, new_val)
    return {"success": True, "field_name": target_name, "value": new_val}


@router.put("/documents/{doc_id}/table")
@router.put("/table/{doc_id}/{table_index}")
def update_table(
    doc_id: str,
    table_index: int = 0,
    body: Optional[TableUpdateBody] = None,
):
    """Saves user cell edits to line item table (supports 2D array or dict rows)."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    raw_rows = body.rows if body and body.rows is not None else []
    headers = body.headers if body and body.headers else []

    # If rows are 2D arrays, convert to list of dicts for database
    if raw_rows and isinstance(raw_rows[0], list):
        if not headers and doc.get("table") and doc["table"].get("columns"):
            headers = doc["table"]["columns"]
        dict_rows = []
        for r in raw_rows:
            row_dict = {}
            for idx, h in enumerate(headers):
                row_dict[h] = r[idx] if idx < len(r) else ""
            dict_rows.append(row_dict)
        update_table_rows(doc_id, dict_rows)
    else:
        update_table_rows(doc_id, raw_rows)

    return {"success": True, "rows": raw_rows}


@router.patch("/documents/{doc_id}/status")
def change_status(doc_id: str, body: StatusUpdateBody):
    """Updates document workflow status ('approved', 'needs_review')."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    update_document_status(doc_id, body.status)
    return {"success": True, "status": body.status}


@router.delete("/documents/{doc_id}")
def delete_doc(doc_id: str):
    """Deletes document and files."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    for path_key in ["file_path", "preprocessed_path", "annotated_path"]:
        p = doc.get(path_key)
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    delete_document(doc_id)
    return {"success": True, "deleted": doc_id}


@router.get("/export/{doc_id}")
def export_document_data(
    doc_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv|json)$"),
):
    """Exports document fields and tables as Excel (.xlsx), CSV, or JSON."""
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    base_name = Path(doc["filename"]).stem

    if format == "json":
        json_str = ExportService.to_json(doc)
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_extracted.json"'},
        )

    if format == "csv":
        csv_str = ExportService.to_csv(doc["fields"], doc.get("table"))
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{base_name}_extracted.csv"'},
        )

    # Excel (.xlsx) default
    excel_bytes = ExportService.to_excel(
        doc_name=doc["filename"],
        doc_type=doc.get("document_type", "Document"),
        fields=doc["fields"],
        table=doc.get("table"),
    )
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{base_name}_extracted.xlsx"'},
    )


@router.post("/documents/{doc_id}/approve-to-rag")
def approve_and_add_to_rag(doc_id: str, request: Request):
    """
    Approves document and indexes its structured data directly into the active RAG vector database.
    """
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # 1. Format clean text representation for RAG embedding
    lines = [
        f"DOCUMENT: {doc['filename']}",
        f"TYPE: {doc.get('document_type', 'Document')}",
        "--- EXTRACTED FIELDS ---",
    ]
    for f in doc["fields"]:
        lines.append(f"{f['label']}: {f.get('value', '')}")

    if doc.get("table") and doc["table"].get("rows"):
        lines.append("\n--- TABLE / LINE ITEMS ---")
        headers = doc["table"].get("columns", [])
        lines.append(" | ".join(headers))
        for r in doc["table"]["rows"]:
            lines.append(" | ".join([str(r.get(h, "")) for h in headers]))

    content_to_index = "\n".join(lines)

    # 2. Save text representation to disk
    rag_doc_path = RAG_OCR_DIR / f"{doc_id}_{Path(doc['filename']).stem}.txt"
    with open(rag_doc_path, "w", encoding="utf-8") as f:
        f.write(content_to_index)

    # 3. Add to live RAGPipeline vector store if initialized
    chunks_added = 0
    try:
        pipeline = getattr(request.app.state, "pipeline", None)
        if pipeline and hasattr(pipeline, "store") and pipeline.store is not None:
            from rag.chunker import chunk_text
            chunks = chunk_text(content_to_index, chunk_size=200, overlap=40)
            if chunks:
                embeddings = pipeline.embedder.embed(chunks)
                pipeline.store.add(embeddings, chunks)
                chunks_added = len(chunks)
    except Exception as e:
        print(f"[RAG Bridge Warning] Could not append to vector store: {e}")

    # 4. Mark status as approved
    update_document_status(doc_id, "approved")

    return {
        "success": True,
        "document_id": doc_id,
        "status": "approved",
        "chunks_indexed": chunks_added,
        "message": f"Successfully approved and indexed '{doc['filename']}' into Q&A knowledge base.",
    }


@router.post("/approve-to-rag")
def approve_to_rag_alias(body: ApproveRagBody, request: Request):
    """Alias for approving to RAG using JSON body with doc_id."""
    return approve_and_add_to_rag(body.doc_id, request)

