"""
End-to-end HTTP API Test for AI Document Processing & OCR Pipeline.
Uses FastAPI TestClient to test upload -> extract -> edit field -> export -> approve-to-rag.
"""

import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from main import app, init_ocr_db

def run_api_test():
    print("=" * 65)
    print("AI DOCUMENT PROCESSING & OCR PIPELINE - FASTAPI ENDPOINT TEST")
    print("=" * 65)

    init_ocr_db()
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("[1. Server Health] OK")

    # 2. Upload sample invoice
    sample_img = BACKEND_DIR.parent / "sample_documents" / "invoices" / "sample_invoice_tilted.jpg"
    assert sample_img.exists(), "Sample invoice image does not exist."

    with open(sample_img, "rb") as f:
        upload_res = client.post(
            "/api/ocr/upload",
            files={"file": ("sample_invoice_tilted.jpg", f, "image/jpeg")},
            data={"document_type": "Invoice"},
        )
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    doc_id = upload_data["id"]
    print(f"[2. Upload] Success! doc_id={doc_id}, status={upload_data['status']}")

    # 3. List documents
    list_res = client.get("/api/ocr/documents")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert any(d["id"] == doc_id for d in docs)
    print(f"[3. List Documents] Success! Found {len(docs)} documents.")

    # 4. Run Extraction Pipeline
    print("[4. Running Extraction Pipeline via HTTP POST /api/ocr/extract/{doc_id}] ...")
    extract_res = client.post(f"/api/ocr/extract/{doc_id}")
    assert extract_res.status_code == 200, f"Extract failed: {extract_res.text}"
    doc_data = extract_res.json()
    print(f"    - Status: {doc_data['status']}")
    print(f"    - Type: {doc_data['document_type']} ({int(doc_data['classification_confidence']*100)}%)")
    print(f"    - Overall Confidence: {doc_data['overall_confidence']}%")
    print(f"    - Fields extracted: {len(doc_data['fields'])}")
    if doc_data.get("table") and doc_data["table"].get("rows"):
        print(f"    - Line Items: {len(doc_data['table']['rows'])} rows")

    # 5. Field update (inline edit)
    update_res = client.put(
        f"/api/ocr/documents/{doc_id}/fields",
        json={"field_name": "vendor_name", "value": "ACME SUPPLIES PRIVATE LIMITED"}
    )
    assert update_res.status_code == 200
    print("[5. Field Edit] Updated vendor_name to 'ACME SUPPLIES PRIVATE LIMITED'")

    # 6. Export to Excel
    export_res = client.get(f"/api/ocr/export/{doc_id}?format=xlsx")
    assert export_res.status_code == 200
    assert len(export_res.content) > 1000
    print(f"[6. Export Excel] Success! Received {len(export_res.content)} bytes of .xlsx data.")

    # 7. Approve & Add to RAG
    rag_res = client.post(f"/api/ocr/documents/{doc_id}/approve-to-rag")
    assert rag_res.status_code == 200, f"RAG bridge failed: {rag_res.text}"
    rag_data = rag_res.json()
    print(f"[7. Approve -> RAG Bridge] Success! {rag_data['message']}")

    print("\n" + "=" * 65)
    print("ALL OCR BACKEND REST ENDPOINTS VERIFIED & PASSING!")
    print("=" * 65)

if __name__ == "__main__":
    run_api_test()

