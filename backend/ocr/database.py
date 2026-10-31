"""
Database schema and persistence helpers for the AI Document Processing & OCR Pipeline.
Uses unified app.db via core.database.get_db.
"""

import json
import sqlite3
from typing import List, Dict, Any, Optional
from core.database import get_db


def init_ocr_db():
    """Initializes tables for documents, extracted fields, tables, and batches."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ocr_documents (
                id                        TEXT PRIMARY KEY,
                user_id                   TEXT,
                batch_id                  TEXT,
                filename                  TEXT NOT NULL,
                file_type                 TEXT NOT NULL,
                file_path                 TEXT NOT NULL,
                preprocessed_path         TEXT,
                annotated_path            TEXT,
                document_type             TEXT,
                classification_confidence REAL DEFAULT 0.0,
                overall_confidence        INTEGER DEFAULT 0,
                needs_review_count        INTEGER DEFAULT 0,
                status                    TEXT DEFAULT 'queued',
                page_count                INTEGER DEFAULT 1,
                t_preprocess              REAL DEFAULT 0.0,
                t_ocr                     REAL DEFAULT 0.0,
                t_classify                REAL DEFAULT 0.0,
                t_extract                 REAL DEFAULT 0.0,
                t_merge                   REAL DEFAULT 0.0,
                raw_text                  TEXT,
                error_message             TEXT,
                created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ocr_docs_status ON ocr_documents(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ocr_docs_user ON ocr_documents(user_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS ocr_fields (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id      TEXT NOT NULL,
                field_name       TEXT NOT NULL,
                label            TEXT NOT NULL,
                value            TEXT,
                category         TEXT DEFAULT 'Names',
                color            TEXT DEFAULT '#f97316',
                confidence       REAL DEFAULT 0.0,
                confidence_level TEXT DEFAULT 'High',
                confidence_pct   INTEGER DEFAULT 0,
                bbox_norm        TEXT,
                discrepancy      TEXT,
                FOREIGN KEY (document_id) REFERENCES ocr_documents(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ocr_fields_doc ON ocr_fields(document_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS ocr_tables (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id  TEXT NOT NULL,
                table_name   TEXT DEFAULT 'Table',
                columns_json TEXT NOT NULL DEFAULT '[]',
                rows_json    TEXT NOT NULL DEFAULT '[]',
                bbox_norm    TEXT,
                FOREIGN KEY (document_id) REFERENCES ocr_documents(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ocr_tables_doc ON ocr_tables(document_id)")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS ocr_batches (
                id              TEXT PRIMARY KEY,
                user_id         TEXT,
                total_count     INTEGER DEFAULT 0,
                processed_count INTEGER DEFAULT 0,
                status          TEXT DEFAULT 'processing',
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ocr_batches_user ON ocr_batches(user_id)")


# ── Query Helpers ──────────────────────────────────────────────────────────

def save_document(doc: Dict[str, Any]):
    """Inserts or updates an OCR document record."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO ocr_documents (
                id, user_id, batch_id, filename, file_type, file_path, preprocessed_path,
                annotated_path, document_type, classification_confidence, overall_confidence,
                needs_review_count, status, page_count, t_preprocess, t_ocr, t_classify,
                t_extract, t_merge, raw_text, error_message, updated_at
            ) VALUES (
                :id, :user_id, :batch_id, :filename, :file_type, :file_path, :preprocessed_path,
                :annotated_path, :document_type, :classification_confidence, :overall_confidence,
                :needs_review_count, :status, :page_count, :t_preprocess, :t_ocr, :t_classify,
                :t_extract, :t_merge, :raw_text, :error_message, CURRENT_TIMESTAMP
            )
            ON CONFLICT(id) DO UPDATE SET
                document_type=excluded.document_type,
                classification_confidence=excluded.classification_confidence,
                overall_confidence=excluded.overall_confidence,
                needs_review_count=excluded.needs_review_count,
                status=excluded.status,
                preprocessed_path=excluded.preprocessed_path,
                annotated_path=excluded.annotated_path,
                t_preprocess=excluded.t_preprocess,
                t_ocr=excluded.t_ocr,
                t_classify=excluded.t_classify,
                t_extract=excluded.t_extract,
                t_merge=excluded.t_merge,
                raw_text=excluded.raw_text,
                error_message=excluded.error_message,
                updated_at=CURRENT_TIMESTAMP
        """, doc)


def save_fields_and_table(doc_id: str, fields: List[Dict[str, Any]], table: Optional[Dict[str, Any]] = None, table_bbox: Optional[List[float]] = None):
    """Saves extracted fields and table for a document (replaces previous)."""
    with get_db() as conn:
        conn.execute("DELETE FROM ocr_fields WHERE document_id = ?", (doc_id,))
        conn.execute("DELETE FROM ocr_tables WHERE document_id = ?", (doc_id,))

        for f in fields:
            bbox_str = json.dumps(f.get("bbox_norm")) if f.get("bbox_norm") else None
            conn.execute("""
                INSERT INTO ocr_fields (
                    document_id, field_name, label, value, category, color,
                    confidence, confidence_level, confidence_pct, bbox_norm, discrepancy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                doc_id,
                f.get("name", ""),
                f.get("label", ""),
                str(f.get("value", "") or ""),
                f.get("category", "Names"),
                f.get("color", "#f97316"),
                float(f.get("confidence", 0.85)),
                f.get("confidence_level", "High"),
                int(f.get("confidence_pct", 85)),
                bbox_str,
                f.get("discrepancy"),
            ))

        if table and table.get("rows"):
            conn.execute("""
                INSERT INTO ocr_tables (
                    document_id, table_name, columns_json, rows_json, bbox_norm
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                doc_id,
                table.get("name", "Table"),
                json.dumps(table.get("columns", [])),
                json.dumps(table.get("rows", [])),
                json.dumps(table_bbox) if table_bbox else None,
            ))


def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full document record with fields and table."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM ocr_documents WHERE id = ?", (doc_id,)).fetchone()
        if not row:
            return None
        doc = dict(row)

        # Fields
        field_rows = conn.execute("SELECT * FROM ocr_fields WHERE document_id = ? ORDER BY id ASC", (doc_id,)).fetchall()
        doc["fields"] = []
        for fr in field_rows:
            f = dict(fr)
            f["bbox_norm"] = json.loads(f["bbox_norm"]) if f.get("bbox_norm") else None
            doc["fields"].append(f)

        # Table
        table_row = conn.execute("SELECT * FROM ocr_tables WHERE document_id = ?", (doc_id,)).fetchone()
        if table_row:
            t = dict(table_row)
            doc["table"] = {
                "name": t["table_name"],
                "columns": json.loads(t["columns_json"]),
                "rows": json.loads(t["rows_json"]),
                "bbox_norm": json.loads(t["bbox_norm"]) if t.get("bbox_norm") else None,
            }
        else:
            doc["table"] = None

        return doc


def list_documents(user_id: Optional[str] = None, search: Optional[str] = None, doc_type: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Lists documents with filtering and search."""
    with get_db() as conn:
        query = "SELECT * FROM ocr_documents WHERE 1=1"
        params = []

        if user_id:
            query += " AND (user_id = ? OR user_id IS NULL)"
            params.append(user_id)
        if doc_type and doc_type != "All":
            query += " AND document_type = ?"
            params.append(doc_type)
        if status and status != "All":
            query += " AND status = ?"
            params.append(status)
        if search:
            query += " AND (filename LIKE ? OR raw_text LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def update_field_value(doc_id: str, field_name: str, new_value: str):
    """Updates a single field value from user correction."""
    with get_db() as conn:
        conn.execute("""
            UPDATE ocr_fields SET value = ?, confidence = 1.0, confidence_level = 'High', confidence_pct = 100, discrepancy = NULL
            WHERE document_id = ? AND field_name = ?
        """, (new_value, doc_id, field_name))
        conn.execute("UPDATE ocr_documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (doc_id,))


def update_table_rows(doc_id: str, new_rows: List[Dict[str, Any]]):
    """Updates the table rows from user cell edits."""
    with get_db() as conn:
        conn.execute("""
            UPDATE ocr_tables SET rows_json = ? WHERE document_id = ?
        """, (json.dumps(new_rows), doc_id))
        conn.execute("UPDATE ocr_documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (doc_id,))


def update_document_status(doc_id: str, new_status: str):
    """Updates document status (e.g. 'approved', 'needs_review')."""
    with get_db() as conn:
        conn.execute("UPDATE ocr_documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, doc_id))


def delete_document(doc_id: str):
    """Deletes a document and its fields/tables."""
    with get_db() as conn:
        conn.execute("DELETE FROM ocr_documents WHERE id = ?", (doc_id,))

