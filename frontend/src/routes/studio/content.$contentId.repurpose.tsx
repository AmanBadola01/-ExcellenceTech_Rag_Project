import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { api, errorMessage, type ContentPiece } from "@/lib/api";

export const Route = createFileRoute("/studio/content/$contentId/repurpose")({
  ssr: false,
  component: RepurposePage,
});

const REPURPOSE_FORMATS = [
  {
    id: "twitter_thread",
    title: "Twitter / X Thread",
    icon: "🐦",
    desc: "4–6 engaging tweets with numbering, hooks, and clean spacing.",
  },
  {
    id: "linkedin_post",
    title: "LinkedIn Post",
    icon: "💼",
    desc: "Professional format with strong opening hook, scannable bullets, and CTA.",
  },
  {
    id: "tldr_summary",
    title: "Executive Summary / TL;DR",
    icon: "📌",
    desc: "One-line summary and core bullet takeaways for quick briefings.",
  },
  {
    id: "email_teaser",
    title: "Email Newsletter Teaser",
    icon: "✉️",
    desc: "Subject line options and an enticing teaser driving clicks.",
  },
];

function RepurposePage() {
  const { contentId } = useParams({ from: "/studio/content/$contentId/repurpose" });
  const navigate = useNavigate();

  const [piece, setPiece] = useState<ContentPiece | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Repurpose form states
  const [targetFormat, setTargetFormat] = useState(REPURPOSE_FORMATS[0].id);
  const [instructions, setInstructions] = useState("");
  const [saveAsNewPiece, setSaveAsNewPiece] = useState(true);

  // Result state
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeError, setRepurposeError] = useState<string | null>(null);
  const [resultText, setResultText] = useState("");
  const [newPieceId, setNewPieceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api.getPiece(contentId);
        setPiece(data);
      } catch (err: any) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [contentId]);

  const handleRepurpose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!piece) return;

    setRepurposing(true);
    setRepurposeError(null);
    setResultText("");
    setNewPieceId(null);

    try {
      const res: any = await api.repurposePiece(piece.id, {
        target_format: targetFormat,
        instructions: instructions.trim(),
        save_as_new_piece: saveAsNewPiece,
      });

      if (saveAsNewPiece && res.id) {
        setResultText(res.content);
        setNewPieceId(res.id);
      } else if (res.repurposed_content) {
        setResultText(res.repurposed_content);
      }
    } catch (err) {
      setRepurposeError(errorMessage(err));
    } finally {
      setRepurposing(false);
    }
  };

  const handleCopy = async () => {
    if (!resultText) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="h-6 w-32 animate-pulse rounded bg-muted mb-6" />
        <div className="h-10 w-64 animate-pulse rounded bg-muted mb-8" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-card/40" />
          <div className="h-80 animate-pulse rounded-2xl bg-card/40" />
        </div>
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Back Navigation ── */}
      <button
        type="button"
        onClick={() => void navigate({ to: "/studio/content/$contentId", params: { contentId: piece.id } })}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to original piece
      </button>

      {/* ── Header Banner ── */}
      <div className="mb-8 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Repurposing Source
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{piece.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 max-w-3xl">
          {piece.content}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ── Left Column: Format Options Form (5 cols) ── */}
        <div className="lg:col-span-5">
          <form onSubmit={handleRepurpose} className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div>
              <label className="text-sm font-semibold text-foreground">Select New Format</label>
              <div className="mt-2.5 flex flex-col gap-2">
                {REPURPOSE_FORMATS.map((f) => {
                  const active = targetFormat === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTargetFormat(f.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <span className="text-xl">{f.icon}</span>
                      <div>
                        <div className="font-semibold text-xs text-foreground">{f.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Angle / Instructions */}
            <div>
              <label className="text-sm font-semibold text-foreground">
                Custom Angle / Focus (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Focus on our product's ease of use, or make the opening tweet question-based."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="mt-1.5 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Save as New Piece toggle */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={saveAsNewPiece}
                onChange={(e) => setSaveAsNewPiece(e.target.checked)}
                className="rounded border-border accent-[hsl(var(--sidebar-primary))]"
              />
              <div>
                <span className="font-medium text-foreground">Save as new content piece</span>
                <p className="text-[10px] text-muted-foreground">
                  Adds the repurposed copy directly to this project's pieces list.
                </p>
              </div>
            </label>

            {repurposeError && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {repurposeError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={repurposing}
              className="mt-2 flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] py-3 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] shadow transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {repurposing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Repurposing with Groq AI…</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  <span>Repurpose Content</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Right Column: Repurposed Result (7 cols) ── */}
        <div className="flex flex-col lg:col-span-7">
          <div className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-sm min-h-[460px]">
            {/* Toolbar */}
            <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
              <span className="text-sm font-semibold text-foreground">Repurposed Copy</span>

              {resultText && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {copied ? (
                      <span className="text-green-500 font-semibold">✓ Copied!</span>
                    ) : (
                      <span>Copy text</span>
                    )}
                  </button>

                  {newPieceId && (
                    <button
                      type="button"
                      onClick={() => void navigate({ to: "/studio/content/$contentId", params: { contentId: newPieceId } })}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      Open new piece →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Output Display */}
            {repurposing ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm font-medium text-foreground">Transforming content with Groq AI...</p>
                <p className="text-xs text-muted-foreground">Adapting style and layout for target channel</p>
              </div>
            ) : resultText ? (
              <div className="flex-1 overflow-y-auto">
                {newPieceId && (
                  <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-xs font-medium text-green-600 dark:text-green-400">
                    ✓ Repurposed copy has been automatically saved as a new draft piece in this project.
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed text-sm">
                  <ReactMarkdown>{resultText}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Repurposed draft will appear here</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Pick a format (like Twitter Thread or LinkedIn Post) and click Repurpose Content.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
