import React, { useState, useEffect, useRef } from "react";
import {
  getDocuments,
  uploadDocuments,
  extractDocument,
  deleteDocument,
  OcrDocumentSummary,
} from "@/lib/ocrApi";

interface IngestionDeckProps {
  onSelectDocument: (docId: string) => void;
  showToast: (msg: string) => void;
}

export function IngestionDeck({ onSelectDocument, showToast }: IngestionDeckProps) {
  const [documents, setDocuments] = useState<OcrDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error("Failed to load OCR documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDocs();
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    try {
      setUploading(true);
      showToast(`Ingesting ${fileArray.length} document(s)...`);
      const uploaded = await uploadDocuments(fileArray);
      showToast(`Successfully uploaded ${uploaded.length} document(s).`);
      await fetchDocs();

      // Automatically trigger extraction for the first uploaded document
      if (uploaded.length > 0 && uploaded[0].id) {
        handleExtract(uploaded[0].id, uploaded[0].filename);
      }
    } catch (err: any) {
      showToast(`Upload error: ${err.message || "Failed to upload"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async (docId: string, filename: string) => {
    try {
      setExtractingId(docId);
      showToast(`Running OpenCV + EasyOCR + Gemini pipeline on ${filename}...`);
      await extractDocument(docId);
      showToast(`Extraction complete for ${filename}!`);
      await fetchDocs();
      onSelectDocument(docId);
    } catch (err: any) {
      showToast(`Extraction error: ${err.message || "Pipeline failed"}`);
    } finally {
      setExtractingId(null);
    }
  };

  const handleDelete = async (docId: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${filename}?`)) return;

    try {
      await deleteDocument(docId);
      showToast(`Deleted ${filename}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`);
    }
  };

  return (
    <main className="vantage-section-ingestion">
      <div className="vantage-ingestion-hero">
        <div className="vantage-hero-statement">
          <h1>Every document scan, surveyed with optical precision.</h1>
          <p>
            Drop multi-page contracts, tilted phone receipts, and invoices. The engine auto-deskews
            rotation angles, detects tabular line-items, and reconciles neural OCR tokens with Vision LLM
            understanding.
          </p>
        </div>

        {/* Vantage Optical Drop Area */}
        <div
          className={`vantage-optical-drop vantage-ticks ${isDragOver ? "border-[var(--vantage-accent)]" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          role="button"
          tabIndex={0}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
            }}
          />
          <div className="vantage-scanner-reticle">
            <div className="vantage-reticle-ring" />
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9M8 17l4-4 4 4" />
            </svg>
          </div>
          <div className="vantage-drop-heading">
            {uploading ? "Ingesting & Rasterizing Scans..." : "Drop scans or documents to measure"}
          </div>
          <div className="vantage-drop-sub">PDF, PNG, JPEG · Batch ingestion up to 50 files</div>
        </div>
      </div>

      {/* Capture Log Section */}
      <div className="vantage-scan-log-block">
        <div className="vantage-log-header">
          <h2>Capture Log (Previous Documents)</h2>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "13px", color: "var(--vantage-muted)" }}>
              {documents.length} Captures Recorded · All Coordinates Stored
            </span>
            <button
              type="button"
              className="vantage-btn-line"
              style={{ height: "28px", padding: "0 10px", fontSize: "11px" }}
              onClick={() => void fetchDocs()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="vantage-log-table-frame vantage-ticks">
          <table className="vantage-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Format</th>
                <th>Type</th>
                <th>Rotation Correction</th>
                <th>Tokens Extracted</th>
                <th>Accuracy</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--vantage-muted)" }}>
                    No captures recorded yet. Drop a PDF or document image above to start optical processing.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const isExtracting = extractingId === doc.id;
                  const isReady = doc.status === "complete" || doc.status === "approved";
                  const rotation = doc.rotation_angle != null ? `${doc.rotation_angle.toFixed(2)}°` : "0.00°";
                  const score = doc.confidence_score != null ? Math.round(doc.confidence_score * 100) : null;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => {
                        if (isReady) onSelectDocument(doc.id);
                        else handleExtract(doc.id, doc.filename);
                      }}
                    >
                      <td>
                        <span className={`vantage-row-dot ${isReady ? "live" : ""}`} />
                        <strong>{doc.filename}</strong>
                      </td>
                      <td>{doc.file_type.toUpperCase()} ({doc.num_pages || 1}p)</td>
                      <td>{doc.document_type || "Generic"}</td>
                      <td className="vantage-num">
                        {rotation}
                      </td>
                      <td className="vantage-num">
                        {doc.status === "complete" || doc.status === "approved" ? "32 pts" : "—"}
                      </td>
                      <td className="vantage-num" style={{ color: score && score > 85 ? "var(--vantage-accent)" : "var(--vantage-muted)" }}>
                        {score != null ? `${score}%` : "—"}
                      </td>
                      <td>
                        <span
                          style={{
                            color: doc.is_approved_to_rag
                              ? "var(--vantage-accent)"
                              : doc.status === "complete"
                              ? "var(--vantage-ink)"
                              : "var(--vantage-muted)",
                            fontSize: "12px",
                          }}
                        >
                          {doc.is_approved_to_rag
                            ? "Live / Approved"
                            : doc.status === "complete"
                            ? "Needs Review"
                            : doc.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                          {isReady ? (
                            <button
                              type="button"
                              className="vantage-btn-line"
                              style={{ height: "28px", padding: "0 12px", fontSize: "11px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectDocument(doc.id);
                              }}
                            >
                              Inspect →
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="vantage-btn-pill"
                              style={{ height: "28px", padding: "0 12px", fontSize: "11px" }}
                              disabled={isExtracting}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleExtract(doc.id, doc.filename);
                              }}
                            >
                              {isExtracting ? "Extracting..." : "Extract"}
                            </button>
                          )}
                          <button
                            type="button"
                            className="vantage-btn-line"
                            style={{ height: "28px", width: "28px", padding: 0, justifyContent: "center" }}
                            title="Delete scan"
                            onClick={(e) => void handleDelete(doc.id, doc.filename, e)}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

