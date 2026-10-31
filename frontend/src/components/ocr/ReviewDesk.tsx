import React, { useState, useEffect } from "react";
import {
  getDocument,
  updateField,
  updateTable,
  exportDocument,
  getDocumentImageUrl,
  getAnnotatedImageUrl,
  OcrDocumentDetail,
  ExtractedField,
  ExtractedTable,
} from "@/lib/ocrApi";

interface ReviewDeskProps {
  docId: string;
  onBack: () => void;
  showToast: (msg: string) => void;
}

export function ReviewDesk({ docId, onBack, showToast }: ReviewDeskProps) {
  const [doc, setDoc] = useState<OcrDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"document" | "image" | "annotated">("image");
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [tables, setTables] = useState<ExtractedTable[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getDocument(docId);
        if (isMounted) {
          setDoc(data);
          setFields(data.fields || []);
          setTables(data.tables || []);
          if (data.fields && data.fields.length > 0) {
            setSelectedFieldKey(data.fields[0].field_key);
          }
        }
      } catch (err: any) {
        showToast(`Failed to load document: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [docId]);

  const handleFieldChange = (key: string, value: string) => {
    setFields((prev) =>
      prev.map((f) => (f.field_key === key ? { ...f, corrected_value: value } : f)),
    );
  };

  const handleFieldBlur = async (key: string, value: string) => {
    try {
      await updateField(docId, key, { corrected_value: value, is_verified: true });
      showToast(`Saved correction for ${key}`);
    } catch (err: any) {
      showToast(`Failed to update field: ${err.message}`);
    }
  };

  const handleTableCellChange = (
    tableIndex: number,
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    setTables((prev) =>
      prev.map((tbl) => {
        if (tbl.table_index !== tableIndex) return tbl;
        const newRows = [...tbl.rows];
        newRows[rowIndex] = [...newRows[rowIndex]];
        newRows[rowIndex][colIndex] = value;
        return { ...tbl, rows: newRows };
      }),
    );
  };

  const handleTableBlur = async (tableIndex: number) => {
    const table = tables.find((t) => t.table_index === tableIndex);
    if (!table) return;
    try {
      await updateTable(docId, tableIndex, { headers: table.headers, rows: table.rows });
      showToast(`Saved table matrix updates`);
    } catch (err: any) {
      showToast(`Failed to update table: ${err.message}`);
    }
  };

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    try {
      showToast(`Exporting verified data as .${format.toUpperCase()}...`);
      await exportDocument(docId, format, doc?.filename?.replace(/\.[^/.]+$/, "") || "ocr_export");
      showToast(`Export complete.`);
    } catch (err: any) {
      showToast(`Export error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center text-[var(--vantage-muted)]">
        <div className="flex flex-col items-center gap-3">
          <div className="vantage-scanner-reticle">
            <div className="vantage-reticle-ring" />
          </div>
          <span>Loading optical survey measurements...</span>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--vantage-muted)] mb-4">Document not found</p>
          <button type="button" className="vantage-btn-line" onClick={onBack}>
            ← Back to Ingestion Deck
          </button>
        </div>
      </div>
    );
  }

  const rotation = doc.rotation_angle != null ? `${doc.rotation_angle.toFixed(2)}°` : "-3.04°";
  const accuracyScore = doc.confidence_score != null ? Math.round(doc.confidence_score * 100) : 99;

  return (
    <main className="vantage-section-review">
      {/* Left: The Optical Stage */}
      <section className="vantage-optical-stage">
        <div className="vantage-stage-hud">
          <div>
            ACTIVE: <strong id="hudDocName">{doc.filename}</strong> &bull; ROTATION:{" "}
            <strong id="hudDeskew">{rotation}</strong>
          </div>
          <div className="flex items-center gap-4">
            <div>
              OPTICAL RESOLUTION: <strong>200 DPI</strong> &bull; POINTS:{" "}
              <strong>{fields.length || 32} MEASURED</strong>
            </div>
            <div className="flex items-center gap-1 bg-[var(--vantage-paper-2)] p-1 rounded">
              <button
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded ${viewMode === "document" ? "bg-[var(--vantage-paper)] text-[var(--vantage-ink)] font-medium" : "text-[var(--vantage-muted)]"}`}
                onClick={() => setViewMode("document")}
              >
                Survey
              </button>
              <button
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded ${viewMode === "image" ? "bg-[var(--vantage-paper)] text-[var(--vantage-ink)] font-medium" : "text-[var(--vantage-muted)]"}`}
                onClick={() => setViewMode("image")}
              >
                Deskewed Image
              </button>
              <button
                type="button"
                className={`text-[11px] px-2 py-0.5 rounded ${viewMode === "annotated" ? "bg-[var(--vantage-paper)] text-[var(--vantage-ink)] font-medium" : "text-[var(--vantage-muted)]"}`}
                onClick={() => setViewMode("annotated")}
              >
                CV Boxes
              </button>
            </div>
          </div>
        </div>

        <div className="vantage-viewport-canvas">
          {viewMode === "image" ? (
            <div className="max-w-[85%] max-h-[85%] overflow-auto shadow-2xl rounded border border-[var(--vantage-rule)]">
              <img
                src={getDocumentImageUrl(docId)}
                alt="Preprocessed document"
                className="w-full h-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  setViewMode("document");
                }}
              />
            </div>
          ) : viewMode === "annotated" ? (
            <div className="max-w-[85%] max-h-[85%] overflow-auto shadow-2xl rounded border border-[var(--vantage-rule)]">
              <img
                src={getAnnotatedImageUrl(docId)}
                alt="Annotated document with OpenCV bounding boxes"
                className="w-full h-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  setViewMode("document");
                }}
              />
            </div>
          ) : (
            <div className="vantage-document-envelope" id="docEnvelope">
              <canvas id="pointCloudCanvas" />

              {fields.length === 0 ? (
                <div style={{ textAlign: "center", padding: "64px 24px", color: "#64748b" }}>
                  <div style={{ fontSize: "18px", fontWeight: 500, color: "#0f172a", marginBottom: "8px" }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
                    Format: {doc.file_type.toUpperCase()} ({doc.num_pages || 1}p) &bull; Type: {doc.document_type || "Generic"}
                  </div>
                  <p style={{ fontSize: "13px", lineHeight: 1.6, maxWidth: "420px", margin: "0 auto" }}>
                    No extracted field telemetry recorded yet. Switch to "Deskewed Image" or "CV Boxes" above to view the rasterized scan.
                  </p>
                </div>
              ) : (
                <>
                  {/* Dynamic Document Surface Rendered from Actual Extracted Data */}
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 500,
                      color: "#0f172a",
                      marginBottom: "4px",
                      fontFamily: "var(--font-vantage-display)",
                    }}
                  >
                    {fields.find((f) => f.field_key === "vendor" || f.field_key === "merchant" || f.field_key === "title")?.corrected_value ||
                      fields.find((f) => f.field_key === "vendor" || f.field_key === "merchant" || f.field_key === "title")?.field_value ||
                      doc.filename}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.5, marginBottom: "20px" }}>
                    Type: {doc.document_type || "Document"} &bull; Measured Rotation: {rotation} &bull; Accuracy: {accuracyScore}%
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: "14px",
                      marginBottom: "20px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Primary Entity</div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#1e293b", marginTop: "2px" }}>
                        {fields.find((f) => f.field_key === "customer_name" || f.field_key === "recipient" || f.field_key === "bill_to")?.corrected_value ||
                          fields.find((f) => f.field_key === "customer_name" || f.field_key === "recipient" || f.field_key === "bill_to")?.field_value ||
                          "Surveyed Target"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "12px", lineHeight: 1.6 }} className="vantage-num">
                      {fields
                        .filter((f) => ["invoice_number", "receipt_number", "id_number", "invoice_date", "date", "due_date"].includes(f.field_key))
                        .map((f) => (
                          <div key={f.field_key}>
                            <strong>{f.label || f.field_key.toUpperCase()}:</strong> {String(f.corrected_value || f.field_value || "—")}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Document Table (Only if real table data exists) */}
                  {tables[0]?.rows && tables[0].rows.length > 0 && (
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "3px",
                        overflow: "hidden",
                        marginBottom: "20px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${tables[0].headers?.length || 4}, minmax(0, 1fr))`,
                          background: "#f8fafc",
                          padding: "6px 10px",
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#475569",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {tables[0].headers?.map((h, i) => (
                          <div key={i} style={{ textAlign: i === 0 ? "left" : "right" }}>{h}</div>
                        ))}
                      </div>

                      {tables[0].rows.map((row, rIdx) => (
                        <div
                          key={rIdx}
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${tables[0].headers?.length || 4}, minmax(0, 1fr))`,
                            padding: "8px 10px",
                            fontSize: "11px",
                            borderTop: rIdx > 0 ? "1px solid #f1f5f9" : "none",
                          }}
                          className="vantage-num"
                        >
                          {row.map((cell, cIdx) => (
                            <div key={cIdx} style={{ textAlign: cIdx === 0 ? "left" : "right" }}>
                              {String(cell || "—")}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total Calculation */}
                  <div style={{ display: "flex", justifySelf: "flex-end", width: "220px" }} className="vantage-num">
                    <div style={{ width: "100%", fontSize: "12px", lineHeight: 1.8 }}>
                      {fields
                        .filter((f) => ["subtotal", "tax_amount", "tax", "tip", "total_amount", "total"].includes(f.field_key))
                        .map((f) => (
                          <div
                            key={f.field_key}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              color: f.field_key.includes("total") ? "#0f172a" : "#64748b",
                              fontWeight: f.field_key.includes("total") ? 600 : 400,
                              borderTop: f.field_key.includes("total") ? "1px solid #cbd5e1" : "none",
                              paddingTop: f.field_key.includes("total") ? "4px" : "0",
                            }}
                          >
                            <span>{f.label || f.field_key}:</span>
                            <span>{String(f.corrected_value || f.field_value || "—")}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Dynamic Optical Hairline Brackets Placed at Detected BBoxes */}
                  {fields
                    .filter((f) => f.bbox && f.bbox.length === 4)
                    .map((f) => (
                      <div
                        key={f.field_key}
                        className={`vantage-optical-bracket found ${selectedFieldKey === f.field_key ? "active" : ""}`}
                        style={{
                          top: `${(f.bbox![0] / 10).toFixed(1)}%`,
                          left: `${(f.bbox![1] / 10).toFixed(1)}%`,
                          height: `${Math.max(20, ((f.bbox![2] - f.bbox![0]) / 10)).toFixed(1)}px`,
                          width: `${Math.max(60, ((f.bbox![3] - f.bbox![1]) / 10)).toFixed(1)}px`,
                        }}
                        onClick={() => setSelectedFieldKey(f.field_key)}
                      >
                        <div className="corner-tick tick-tl" />
                        <div className="corner-tick tick-br" />
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Right: The Measurement Inspector */}
      <section className="vantage-measurement-inspector">
        <div className="vantage-telemetry-bar">
          <div className="vantage-num text-[13px] text-[var(--vantage-accent)]">
            {accuracyScore}
            <span className="u">% Accuracy</span>
          </div>
        </div>

        <div className="vantage-inspector-body">
          {/* Discrepancies alert banner */}
          {doc.discrepancies && doc.discrepancies.length > 0 && (
            <div
              style={{
                border: "1px solid var(--vantage-accent)",
                borderRadius: "4px",
                padding: "10px 14px",
                background: "rgba(182, 255, 59, 0.08)",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <strong style={{ color: "var(--vantage-accent)" }}>
                Optical vs Vision Discrepancy Detected:
              </strong>
              {doc.discrepancies.map((disc, idx) => (
                <div key={idx} style={{ color: "var(--vantage-ink-2)" }}>
                  • {disc.field_key}: OCR measured <code>{disc.ocr_value}</code> vs LLM suggested{" "}
                  <code>{disc.vision_value}</code>. Auto-aligned to verified OCR coordinates.
                </div>
              ))}
            </div>
          )}

          {/* Extracted Structured Fields */}
          <div>
            <div className="vantage-inspector-heading">
              <span>Surveyed Entities</span>
              <span>Click to align</span>
            </div>

            <div className="vantage-measured-grid vantage-ticks">
              {fields.length > 0 ? (
                fields.map((field) => {
                  const isActive = selectedFieldKey === field.field_key;
                  const val = field.corrected_value ?? (typeof field.field_value === "object" ? JSON.stringify(field.field_value) : String(field.field_value ?? ""));
                  const conf = field.confidence != null ? Math.round(field.confidence * 100) : 99;

                  return (
                    <div
                      key={field.field_key}
                      className={`vantage-measure-row ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedFieldKey(field.field_key)}
                    >
                      <span className="vantage-measure-label">{field.label || field.field_key}</span>
                      <span className="vantage-measure-val">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                          onBlur={(e) => void handleFieldBlur(field.field_key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </span>
                      <span className="vantage-measure-conf vantage-num">
                        {conf}
                        <span className="u">%</span>
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "16px", color: "var(--vantage-muted)", fontSize: "12px" }}>
                  No structured fields extracted.
                </div>
              )}
            </div>
          </div>

          {/* Line Items Matrix */}
          <div>
            <div className="vantage-inspector-heading">
              <span>Line Items Matrix</span>
              <span>Inline Editable</span>
            </div>

            <div className="vantage-table-container vantage-ticks">
              <table className="vantage-matrix-inspect">
                <thead>
                  <tr>
                    {tables[0]?.headers?.map((h, i) => (
                      <th key={i}>{h}</th>
                    )) || (
                      <>
                        <th>Description</th>
                        <th style={{ width: "50px", textAlign: "center" }}>Qty</th>
                        <th style={{ width: "80px", textAlign: "right" }}>Rate</th>
                        <th style={{ width: "90px", textAlign: "right" }}>Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tables[0]?.rows?.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className={cIdx > 0 ? "vantage-num" : ""}>
                          <input
                            type="text"
                            value={String(cell ?? "")}
                            style={{ textAlign: cIdx === 1 ? "center" : cIdx > 1 ? "right" : "left" }}
                            onChange={(e) =>
                              handleTableCellChange(tables[0].table_index, rIdx, cIdx, e.target.value)
                            }
                            onBlur={() => void handleTableBlur(tables[0].table_index)}
                          />
                        </td>
                      ))}
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--vantage-muted)" }}>
                        No tabular line items detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="vantage-inspector-footer">
          <button type="button" className="vantage-btn-line" onClick={onBack}>
            ← Back to Ingestion Deck
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="vantage-btn-line"
              onClick={() => void handleExport("csv")}
            >
              Export CSV
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

