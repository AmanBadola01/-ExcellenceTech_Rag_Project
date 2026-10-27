import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api, errorMessage, type Project, type ContentPiece } from "@/lib/api";

export const Route = createFileRoute("/studio/projects/")({
  ssr: false,
  component: ProjectsIndexPage,
});

function ProjectsIndexPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentPieces, setRecentPieces] = useState<ContentPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [projList, piecesList] = await Promise.all([
        api.listProjects(),
        api.listAllPieces(10),
      ]);
      setProjects(projList);
      setRecentPieces(piecesList);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setCreating(true);
    setCreateError("");
    try {
      const created = await api.createProject({
        name: projectName.trim(),
        description: projectDesc.trim(),
      });
      setProjects((prev) => [created, ...prev]);
      setProjectName("");
      setProjectDesc("");
      setIsModalOpen(false);
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* ── Top Header Bar ── */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
        <button
          type="button"
          onClick={() => {
            setCreateError("");
            setIsModalOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New project
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-border/50 bg-card/40 p-6"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* ── Empty State ── */
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/30 p-10 text-center">
          <h2 className="text-base font-semibold text-foreground">No projects yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use "New project" above to group your campaigns, blog drafts, and ad copy.
          </p>
        </div>
      ) : (
        /* ── Grid of Project Cards ── */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {projects.map((proj) => (
            <Link
              key={proj.id}
              to="/studio/projects/$projectId"
              params={{ projectId: proj.id }}
              className="group relative flex min-h-[148px] cursor-pointer flex-col justify-between rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:border-border hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                    {proj.name}
                  </h2>
                  <button
                    type="button"
                    title="Delete project"
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 text-muted-foreground p-1"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
                {proj.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {proj.description}
                  </p>
                )}
              </div>

              {/* Count badge */}
              <div className="mt-4">
                <span className="inline-flex items-center rounded-md bg-sky-950/70 px-3 py-1 text-xs font-semibold text-sky-400 border border-sky-800/50">
                  {proj.piece_count ?? 0} {proj.piece_count === 1 ? "piece" : "pieces"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Recent Generated Content Section ── */}
      <div className="mt-12 border-t border-border/60 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Recent Content</h2>
          <Link
            to="/studio/generate"
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Generate new piece
          </Link>
        </div>

        {recentPieces.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/40 p-6 text-center text-xs text-muted-foreground">
            No generated content pieces yet. Click &quot;+ Generate content&quot; in the sidebar to create your first draft!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentPieces.map((piece) => (
              <Link
                key={piece.id}
                to="/studio/content/$contentId"
                params={{ contentId: piece.id }}
                className="group flex flex-col justify-between rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-border hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="inline-flex items-center rounded bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground">
                      {piece.content_type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {piece.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {piece.title}
                  </h3>
                  {piece.content && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {piece.content}
                    </p>
                  )}
                </div>

                <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>{piece.created_at ? new Date(piece.created_at).toLocaleDateString() : ""}</span>
                  <span className="text-sky-500 group-hover:underline">Open piece →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Project Dialog / Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-foreground">Create new project</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Group your marketing campaigns, blog drafts, and ad copy.
            </p>

            <form onSubmit={handleCreate} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Project name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Product launch, Q2 campaign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Blog series and social posts for the AI analytics tool."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {createError && (
                <p className="text-xs font-medium text-destructive">{createError}</p>
              )}

              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !projectName.trim()}
                  className="rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

