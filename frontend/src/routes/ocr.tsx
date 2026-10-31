import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { getToken } from "@/lib/api";
import { AmbientBackground } from "@/components/ocr/AmbientBackground";
import { IngestionDeck } from "@/components/ocr/IngestionDeck";
import { ReviewDesk } from "@/components/ocr/ReviewDesk";
import { VantageToast } from "@/components/ocr/VantageToast";
import { exportDocument } from "@/lib/ocrApi";

export const Route = createFileRoute("/ocr")({
  ssr: false,
  beforeLoad: () => {
    if (!getToken()) {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: OcrLayout,
});

function OcrLayout() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<"ingestion" | "review">("ingestion");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toastTimerRef = React.useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleHeaderExport = async () => {
    if (!selectedDocId) {
      showToast("Select a document to export.");
      return;
    }
    try {
      showToast("Exporting verified data as formatted Excel (.xlsx)...");
      await exportDocument(selectedDocId, "xlsx", "ocr_verified_export");
      showToast("Excel export complete.");
    } catch (err: any) {
      showToast(`Export error: ${err.message}`);
    }
  };

  return (
    <div className="vantage-root" onClick={() => setDropdownOpen(false)}>
      {/* Ambient Optical Scan Chamber Background */}
      <AmbientBackground />

      {/* Master Navigation */}
      <header className="vantage-nav">
        <div className="nav-left">
          {/* Service Dropdown */}
          <div className="vantage-service-menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="vantage-service-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="vantage-lime-dot" />
              <span>Document Engine</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div className={`vantage-dropdown-tray ${dropdownOpen ? "open" : ""}`}>
              <div
                className="vantage-dropdown-opt"
                onClick={() => {
                  setDropdownOpen(false);
                  void navigate({ to: "/chat" });
                }}
              >
                <strong>Q&amp;A Agent</strong>
                <small>Vector semantic document question answering</small>
              </div>
              <div
                className="vantage-dropdown-opt"
                onClick={() => {
                  setDropdownOpen(false);
                  void navigate({ to: "/studio/projects" });
                }}
              >
                <strong>Content Studio</strong>
                <small>Brand voice synthesis &amp; multi-channel repurposing</small>
              </div>
              <div className="vantage-dropdown-opt active">
                <strong>Document Engine (Vantage)</strong>
                <small>Optical reality capture &amp; neural OCR extraction</small>
              </div>
            </div>
          </div>

          {/* Section Toggles: Ingestion Deck vs Review Desk */}
          <div className="vantage-view-toggles">
            <button
              type="button"
              className={`vantage-view-tab ${currentView === "ingestion" ? "active" : ""}`}
              onClick={() => setCurrentView("ingestion")}
            >
              Ingestion Deck &amp; Scan Log
            </button>
            <button
              type="button"
              className={`vantage-view-tab ${currentView === "review" ? "active" : ""}`}
              onClick={() => {
                if (selectedDocId) {
                  setCurrentView("review");
                } else {
                  showToast("Select a document from the Capture Log first.");
                }
              }}
            >
              Review Desk
            </button>
          </div>
        </div>

        <div className="vantage-nav-actions">
          <button
            type="button"
            className="vantage-btn-line"
            onClick={() => void handleHeaderExport()}
          >
            Export .xlsx
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {currentView === "ingestion" || !selectedDocId ? (
        <IngestionDeck
          onSelectDocument={(id) => {
            setSelectedDocId(id);
            setCurrentView("review");
          }}
          showToast={showToast}
        />
      ) : (
        <ReviewDesk
          docId={selectedDocId}
          onBack={() => setCurrentView("ingestion")}
          showToast={showToast}
        />
      )}

      {/* Floating Optical Scan Telemetry Badge (Bottom Left) */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "24px",
          zIndex: 100,
          fontFamily: "var(--font-vantage-mono)",
          fontSize: "11px",
          background: "rgba(14, 18, 23, 0.9)",
          border: "1px solid var(--vantage-rule-2)",
          padding: "8px 14px",
          borderRadius: "var(--radius-vantage-pill)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            width: "7px",
            height: "7px",
            backgroundColor: "var(--vantage-accent)",
            borderRadius: "50%",
            boxShadow: "0 0 8px var(--vantage-accent)",
          }}
        />
        <span style={{ color: "var(--vantage-accent)" }}>OPTICAL MATRIX: ACTIVE</span>
        <span style={{ color: "var(--vantage-muted)" }}>&bull;</span>
        <span style={{ color: "var(--vantage-ink-2)" }}>TELEMETRY GRID ILLUMINATED</span>
      </div>

      {/* Toast Notification HUD */}
      <VantageToast message={toastMessage} />
    </div>
  );
}

