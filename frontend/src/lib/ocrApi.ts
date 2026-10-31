import { getToken, ApiError } from "@/lib/api";

const BASE = ((import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/+$/,
  "",
);

export interface OcrDocumentSummary {
  id: string;
  filename: string;
  file_type: string;
  document_type?: string;
  status: "uploaded" | "queued" | "preprocessing" | "ocr" | "classifying" | "extracting" | "complete" | "error" | "approved";
  num_pages: number;
  rotation_angle?: number;
  confidence_score?: number;
  is_approved_to_rag?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ExtractedField {
  id?: string;
  field_key: string;
  label?: string;
  field_value: any;
  corrected_value?: string;
  confidence: number;
  is_discrepancy?: boolean;
  ocr_source_text?: string;
  bbox?: number[]; // [ymin, xmin, ymax, xmax] in percentages or normalized
  is_verified?: boolean;
}

export interface ExtractedTable {
  id?: string;
  table_index: number;
  headers: string[];
  rows: any[][];
  confidence?: number;
}

export interface OcrDocumentDetail extends OcrDocumentSummary {
  fields: ExtractedField[];
  tables: ExtractedTable[];
  discrepancies?: Array<{
    field_key: string;
    ocr_value: string;
    vision_value: string;
    confidence: number;
  }>;
  metrics?: {
    preprocess_sec?: number;
    ocr_sec?: number;
    vision_sec?: number;
    reconcile_sec?: number;
    total_sec?: number;
  };
}

async function authHeaders(isJson = true): Promise<Record<string, string>> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function uploadDocuments(files: File[]): Promise<OcrDocumentSummary[]> {
  const token = getToken();
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  if (files.length === 1) {
    formData.append("file", files[0]);
  }

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api/ocr/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = `Upload failed (${res.status})`;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

export async function getDocuments(): Promise<OcrDocumentSummary[]> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/documents`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new ApiError("Failed to fetch documents", res.status);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.documents || [];
}

export async function getDocument(docId: string): Promise<OcrDocumentDetail> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/documents/${docId}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new ApiError(`Failed to fetch document ${docId}`, res.status);
  }

  return res.json();
}

export async function extractDocument(
  docId: string,
  model = "gemini-3.8-flash",
): Promise<OcrDocumentDetail> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/extract/${docId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(`Extraction failed: ${err}`, res.status);
  }

  return res.json();
}

export async function updateField(
  docId: string,
  fieldKey: string,
  payload: { corrected_value: string; is_verified?: boolean },
): Promise<{ success: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/fields/${docId}/${encodeURIComponent(fieldKey)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new ApiError("Failed to update field", res.status);
  }

  return res.json();
}

export async function updateTable(
  docId: string,
  tableIndex: number,
  payload: { headers: string[]; rows: any[][] },
): Promise<{ success: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/table/${docId}/${tableIndex}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new ApiError("Failed to update table", res.status);
  }

  return res.json();
}

export async function exportDocument(
  docId: string,
  format: "xlsx" | "csv" | "json",
  filename = "document_export",
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api/ocr/export/${docId}?format=${format}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    throw new ApiError(`Failed to export document as ${format}`, res.status);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export async function approveToRag(
  docId: string,
): Promise<{ success: boolean; indexed_chunks?: number; message?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/approve-to-rag`, {
    method: "POST",
    headers,
    body: JSON.stringify({ doc_id: docId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(`Approval failed: ${errorText}`, res.status);
  }

  return res.json();
}

export async function deleteDocument(docId: string): Promise<{ success: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}/api/ocr/documents/${docId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    throw new ApiError("Failed to delete document", res.status);
  }

  return res.json();
}

export function getDocumentImageUrl(docId: string, pageNum = 1): string {
  const token = getToken();
  return `${BASE}/api/ocr/image/${docId}?page_num=${pageNum}${token ? `&token=${token}` : ""}`;
}

export function getAnnotatedImageUrl(docId: string, pageNum = 1): string {
  const token = getToken();
  return `${BASE}/api/ocr/annotated/${docId}?page_num=${pageNum}${token ? `&token=${token}` : ""}`;
}

