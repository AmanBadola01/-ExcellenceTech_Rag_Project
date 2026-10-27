import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { api, errorMessage, type ContentPiece } from "@/lib/api";

export const Route = createFileRoute("/studio/content/$contentId/")({
  ssr: false,
  component: ContentDetailPage,
});

function ContentDetailPage() {
  const { contentId } = useParams({ from: "/studio/content/$contentId/" });
  const navigate = useNavigate();

  const [piece, setPiece] = useState<ContentPiece | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPiece = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPiece(contentId);
      setPiece(data);
      setTitle(data.title);
      setContent(data.content);
      setStatus(data.status);
    } catch (err: any) {
      if (err?.status === 404) {
        setError("Content piece not found or you don't have permission to view it.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPiece();
  }, [contentId]);

  const handleSave = async () => {
    if (!piece) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.updatePiece(piece.id, {
        title: title.trim(),
        content,
        status,
      });
      setPiece(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!piece) return;
    if (!confirm("Are you sure you want to delete this content piece?")) return;
    try {
      await api.deletePiece(piece.id);
      if (piece.project_id) {
        void navigate({ to: "/studio/projects/$projectId", params: { projectId: piece.project_id } });
      } else {
        void navigate({ to: "/studio/projects" });
      }
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="h-6 w-32 animate-pulse rounded bg-muted mb-6" />
        <div className="h-10 w-3/4 animate-pulse rounded bg-muted mb-4" />
        <div className="h-96 animate-pulse rounded-2xl border border-border/50 bg-card/40 p-6" />
      </div>
    );
  }

  if (error || !piece) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12 text-center">
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <p className="text-base text-destructive mb-4">{error || "Piece could not be found."}</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/studio/projects" })}
            className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
          >
            ← Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* ── Top Bar ── */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (piece.project_id) {
              void navigate({ to: "/studio/projects/$projectId", params: { projectId: piece.project_id } });
            } else {
              void navigate({ to: "/studio/projects" });
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {piece.project_id ? "Back to project" : "Back to projects"}
        </button>

        <div className="flex items-center gap-2">
          {/* Repurpose Button */}
          <button
            type="button"
            onClick={() => void navigate({ to: "/studio/content/$contentId/repurpose", params: { contentId: piece.id } })}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-800/60 bg-sky-950/40 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-900/60 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Repurpose
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            title="Delete piece"
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Metadata Header ── */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded bg-sidebar-accent px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">
            {piece.content_type.replace("_", " ")}
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground capitalize focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            {wordCount} words
          </span>
        </div>

        {/* Editable Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-2xl font-bold tracking-tight text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors pb-1"
          placeholder="Piece title..."
        />
      </div>

      {/* ── Editor / Preview Card ── */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        {/* Card Toolbar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-lg bg-background p-0.5 border border-border/60">
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                tab === "preview" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setTab("edit")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                tab === "edit" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Edit Markdown
            </button>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs font-medium text-green-500 animate-in fade-in">
                ✓ Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-md bg-[hsl(var(--sidebar-primary))] px-3 py-1 text-xs font-semibold text-[hsl(var(--sidebar-primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 min-h-[420px]">
          {tab === "preview" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full resize-y rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>
      </div>
    </div>
  );
}

