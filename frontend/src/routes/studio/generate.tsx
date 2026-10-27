import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { api, errorMessage, type Project, type ContentPiece, type BrandVoice } from "@/lib/api";

export const Route = createFileRoute("/studio/generate")({
  ssr: false,
  component: GeneratePage,
});

const CONTENT_TYPES = [
  { id: "blog", label: "Blog Post", icon: "📝", desc: "Long-form article (quality 120B model)" },
  { id: "social", label: "Social Media", icon: "📱", desc: "LinkedIn & Twitter variants (fast model)" },
  { id: "email", label: "Email Newsletter", icon: "📧", desc: "Subject lines & copy (fast model)" },
  { id: "press_release", label: "Press Release", icon: "📰", desc: "Official PR format (quality 120B model)" },
  { id: "ad_copy", label: "Ad Copy", icon: "🎯", desc: "Headlines & punchy copy (fast model)" },
];

const PRESET_TONES = [
  "Professional & Authoritative",
  "Conversational & Friendly",
  "Bold & Visionary",
  "Witty & Creative",
  "Urgent & Action-Oriented",
];

function GeneratePage() {
  const navigate = useNavigate();

  // Form states
  const [projects, setProjects] = useState<Project[]>([]);
  const [voices, setVoices] = useState<BrandVoice[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [contentType, setContentType] = useState("blog");
  const [tone, setTone] = useState(PRESET_TONES[0]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [includeCompanyContext, setIncludeCompanyContext] = useState(true);

  // Generation status
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultPiece, setResultPiece] = useState<ContentPiece | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load projects and brand voices
    (async () => {
      try {
        const [projList, voiceList] = await Promise.all([
          api.listProjects(),
          api.listBrandVoices(),
        ]);
        setProjects(projList);
        setVoices(voiceList);
        if (voiceList.length > 0) {
          setSelectedVoiceId(voiceList[0].id);
        }
      } catch {
        // Non-blocking
      }
    })();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) return;

    setGenerating(true);
    setError(null);
    setResultPiece(null);

    const activeVoice = voices.find((v) => v.id === selectedVoiceId);

    try {
      const generated = await api.generateContent({
        title: title.trim(),
        prompt: prompt.trim(),
        content_type: contentType,
        tone: activeVoice ? activeVoice.name : tone,
        voice_id: selectedVoiceId || null,
        project_id: selectedProjectId || null,
        include_company_context: includeCompanyContext,
      });
      setResultPiece(generated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!resultPiece?.content) return;
    try {
      await navigator.clipboard.writeText(resultPiece.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const wordCount = resultPiece?.content
    ? resultPiece.content.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Generate Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create AI-powered marketing copy, blog posts, and press releases tailored to your brand.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* ── Left Column: Generator Form Controls (5 cols) ── */}
        <div className="lg:col-span-5">
          <form onSubmit={handleGenerate} className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            {/* Title / Topic */}
            <div>
              <label className="text-sm font-semibold text-foreground">
                Headline / Topic <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 5 Signs Your Team Needs AI Analytics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Content Type Picker */}
            <div>
              <label className="text-sm font-semibold text-foreground">Content Type</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map((t) => {
                  const active = contentType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setContentType(t.id)}
                      className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium text-xs">
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </div>
                      <span className="mt-1 text-[10px] text-muted-foreground line-clamp-1">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assign to Project */}
            <div>
              <label className="text-sm font-semibold text-foreground">Project (Optional)</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No Project (Standalone Draft)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Voice / Tone Selector */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">Brand Voice Persona</label>
                <a
                  href="/studio/brand-voices"
                  onClick={(e) => {
                    e.preventDefault();
                    void navigate({ to: "/studio/brand-voices" });
                  }}
                  className="text-xs text-sky-500 hover:underline"
                >
                  Manage voices →
                </a>
              </div>
              <select
                value={selectedVoiceId}
                onChange={(e) => {
                  setSelectedVoiceId(e.target.value);
                  const v = voices.find((item) => item.id === e.target.value);
                  if (v) setTone(v.name);
                }}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {voices.length > 0 ? (
                  voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.tone_tags ? `(${v.tone_tags})` : ""}
                    </option>
                  ))
                ) : (
                  PRESET_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))
                )}
              </select>
              {selectedVoiceId && (
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                  {voices.find((v) => v.id === selectedVoiceId)?.rules || ""}
                </p>
              )}
            </div>

            {/* Instructions / Key points */}
            <div>
              <label className="text-sm font-semibold text-foreground">
                Brief & Key Instructions <span className="text-destructive">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Mention: our 30-day free trial, sub-second query speed, and target audience is VP of Growth."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mt-1.5 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Company Context Checkbox */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={includeCompanyContext}
                onChange={(e) => setIncludeCompanyContext(e.target.checked)}
                className="mt-0.5 rounded border-border accent-[hsl(var(--sidebar-primary))]"
              />
              <div>
                <span className="font-medium text-foreground">Include Company Profile</span>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Injects your company tagline, target market, offerings, and boilerplate.
                </p>
              </div>
            </label>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={generating || !title.trim() || !prompt.trim()}
              className="mt-2 flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] py-3 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] shadow transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Generating with Groq AI…</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Generate piece</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* ── Right Column: Live Output & Preview (7 cols) ── */}
        <div className="flex flex-col lg:col-span-7">
          <div className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-sm min-h-[480px]">
            {/* Output Header */}
            <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Generated Output</span>
                {resultPiece && (
                  <span className="rounded bg-sky-950/70 px-2 py-0.5 text-xs font-semibold text-sky-400 border border-sky-800/50">
                    {wordCount} words
                  </span>
                )}
              </div>

              {resultPiece && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {resultPiece.project_id && (
                    <button
                      type="button"
                      onClick={() => void navigate({ to: "/studio/projects/$projectId", params: { projectId: resultPiece.project_id! } })}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      View in project →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Output Body */}
            {generating ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm font-medium text-foreground">Drafting your content piece with Groq...</p>
                <p className="text-xs text-muted-foreground">Applying tone and company branding context</p>
              </div>
            ) : resultPiece ? (
              <div className="flex-1 overflow-y-auto">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-foreground">{resultPiece.title}</h2>
                  <span className="text-xs text-muted-foreground capitalize">
                    {resultPiece.content_type.replace("_", " ")} • Saved as draft
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  <ReactMarkdown>{resultPiece.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-accent mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-foreground">Your draft will appear here</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Fill in your topic, pick your desired content type and tone on the left, then click Generate piece.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
