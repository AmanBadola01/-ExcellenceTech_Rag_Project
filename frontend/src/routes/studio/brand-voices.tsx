import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api, errorMessage, type BrandVoice } from "@/lib/api";

export const Route = createFileRoute("/studio/brand-voices")({
  ssr: false,
  component: BrandVoicesPage,
});

function BrandVoicesPage() {
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<BrandVoice | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [toneTags, setToneTags] = useState("");
  const [rules, setRules] = useState("");
  const [sampleQuote, setSampleQuote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadVoices = async () => {
    try {
      setLoading(true);
      const data = await api.listBrandVoices();
      setVoices(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVoices();
  }, []);

  const openCreateModal = () => {
    setEditingVoice(null);
    setName("");
    setDesc("");
    setToneTags("");
    setRules("");
    setSampleQuote("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (v: BrandVoice) => {
    setEditingVoice(v);
    setName(v.name);
    setDesc(v.description);
    setToneTags(v.tone_tags);
    setRules(v.rules);
    setSampleQuote(v.sample_quote);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setFormError("");

    try {
      if (editingVoice) {
        const updated = await api.updateBrandVoice(editingVoice.id, {
          name: name.trim(),
          description: desc.trim(),
          tone_tags: toneTags.trim(),
          rules: rules.trim(),
          sample_quote: sampleQuote.trim(),
        });
        setVoices((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      } else {
        const created = await api.createBrandVoice({
          name: name.trim(),
          description: desc.trim(),
          tone_tags: toneTags.trim(),
          rules: rules.trim(),
          sample_quote: sampleQuote.trim(),
        });
        setVoices((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this brand voice?")) return;
    try {
      await api.deleteBrandVoice(id);
      setVoices((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* ── Top Header ── */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Brand Voices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure custom tones and writing guidelines so AI produces copy tailored to your brand personality.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] shadow transition-opacity hover:opacity-90"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New voice
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Voices Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-border/50 bg-card/40 p-6" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {voices.map((voice) => {
            const tags = voice.tone_tags
              ? voice.tone_tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];
            return (
              <div
                key={voice.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:border-border hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold text-foreground">{voice.name}</h2>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit voice"
                        onClick={() => openEditModal(voice)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Delete voice"
                        onClick={(e) => handleDelete(e, voice.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {voice.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{voice.description}</p>
                  )}

                  {/* Tone Tags */}
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-sidebar-accent px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rules preview */}
                  {voice.rules && (
                    <div className="mt-3 rounded-lg border border-border/40 bg-background/50 p-3 text-xs text-foreground/80 leading-relaxed">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider mb-1">
                        Guidelines &amp; Rules
                      </span>
                      <p className="line-clamp-3">{voice.rules}</p>
                    </div>
                  )}

                  {/* Sample quote */}
                  {voice.sample_quote && (
                    <div className="mt-3 border-l-2 border-primary/60 pl-3 italic text-xs text-muted-foreground">
                      &ldquo;{voice.sample_quote}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Dashed Card ── */}
          <button
            type="button"
            onClick={openCreateModal}
            className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-transparent p-6 text-sm font-medium text-muted-foreground transition-all hover:border-foreground/50 hover:bg-card/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create brand voice</span>
            </div>
          </button>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground">
              {editingVoice ? "Edit Brand Voice" : "New Brand Voice"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tell the AI how to write when speaking in this persona.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Voice Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Founder Bold, Technical Architect"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. Visionary, direct, and thought-provoking"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Tone Attributes (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visionary, Direct, Inspiring"
                  value={toneTags}
                  onChange={(e) => setToneTags(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Writing Rules &amp; Do&apos;s / Don&apos;ts
                </label>
                <textarea
                  rows={4}
                  placeholder="Keep sentences punchy. Avoid buzzwords like 'game-changing'. Use first-person plural ('We built this...')."
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Sample Phrasing / Example Quote
                </label>
                <input
                  type="text"
                  placeholder="e.g. Most software adds friction. We set out to eliminate it entirely."
                  value={sampleQuote}
                  onChange={(e) => setSampleQuote(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {formError && (
                <p className="text-xs font-medium text-destructive">{formError}</p>
              )}

              <div className="mt-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2 text-xs font-semibold text-[hsl(var(--sidebar-primary-foreground))] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingVoice ? "Save changes" : "Create voice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
