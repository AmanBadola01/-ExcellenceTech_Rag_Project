import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { api, errorMessage, type Project, type ContentPiece } from "@/lib/api";

export const Route = createFileRoute("/studio/projects/$projectId")({
  ssr: false,
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = useParams({ from: "/studio/projects/$projectId" });
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projData, piecesData] = await Promise.all([
        api.getProject(projectId),
        api.getProjectPieces(projectId),
      ]);
      setProject(projData);
      setPieces(piecesData);
    } catch (err: any) {
      if (err?.status === 404) {
        setError("Project not found or you don't have access to it.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectId]);

  const handleDeletePiece = async (e: React.MouseEvent, pieceId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this content piece?")) return;
    try {
      await api.deletePiece(pieceId);
      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
      if (project) {
        setProject({ ...project, piece_count: Math.max(0, (project.piece_count ?? 1) - 1) });
      }
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="h-6 w-32 animate-pulse rounded bg-muted mb-6" />
        <div className="h-10 w-64 animate-pulse rounded bg-muted mb-2" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted mb-8" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/50 bg-card/40 p-6" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12 text-center">
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <p className="text-base text-destructive mb-4">{error || "Project could not be found."}</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/studio/projects" })}
            className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
          >
            ← Back to projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* ── Back button ── */}
      <button
        type="button"
        onClick={() => void navigate({ to: "/studio/projects" })}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to projects
      </button>

      {/* ── Project Header ── */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
            <span className="inline-flex items-center rounded-md bg-sky-950/70 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-800/50">
              {project.piece_count ?? pieces.length} {(project.piece_count ?? pieces.length) === 1 ? "piece" : "pieces"}
            </span>
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{project.description}</p>
          )}
        </div>

        {/* Generate CTA */}
        <button
          type="button"
          onClick={() => void navigate({ to: "/studio/generate" })}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] shadow-sm transition-opacity hover:opacity-90"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Generate content
        </button>
      </div>

      {/* ── Pieces Section ── */}
      <div className="border-t border-border/60 pt-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Content Pieces</h2>

        {pieces.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent text-muted-foreground mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground">No content pieces yet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              Start generating blog posts, social campaigns, or press copy for this project.
            </p>
            <button
              type="button"
              onClick={() => void navigate({ to: "/studio/generate" })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              + Generate first piece
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pieces.map((piece) => (
              <div
                key={piece.id}
                onClick={() => void navigate({ to: "/studio/content/$contentId", params: { contentId: piece.id } })}
                className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-border hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider bg-sidebar-accent text-sidebar-foreground">
                      {piece.content_type}
                    </span>
                    <button
                      type="button"
                      title="Delete piece"
                      onClick={(e) => handleDeletePiece(e, piece.id)}
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 text-muted-foreground p-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                    {piece.title}
                  </h3>
                  {piece.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {piece.content}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                  <span className="capitalize">{piece.status}</span>
                  {piece.created_at && (
                    <span>{new Date(piece.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
