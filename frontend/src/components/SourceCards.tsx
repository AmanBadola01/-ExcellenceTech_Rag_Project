import { useState } from "react";

type Source = { text: string; score: number };

function SourceCard({ source, index }: { source: Source; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = typeof source.score === "number" ? source.score.toFixed(2) : String(source.score ?? "");

  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-secondary">Chunk {index + 1}</span>
        <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-medium text-amber">
          {score}
        </span>
      </div>
      <p className={expanded ? "mt-2 whitespace-pre-wrap text-foreground/90" : "mt-2 line-clamp-2 whitespace-pre-wrap text-foreground/90"}>
        {source.text}
      </p>
      {source.text && (source.text.length > 140 || source.text.includes("\n")) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-primary transition-colors duration-150 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function SourceCards({ sources }: { sources: Source[] | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={open ? "rotate-90 transition-transform duration-150" : "transition-transform duration-150"}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        Sources ({sources.length})
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {sources.map((source, i) => (
            <SourceCard key={i} source={source} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
