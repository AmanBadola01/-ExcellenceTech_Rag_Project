import { createFileRoute, Link } from "@tanstack/react-router";

function StubPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 shadow-sm">
        <div className="mb-3 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Coming Soon
        </div>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
        )}
        <Link
          to="/studio/company"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to Company Settings
        </Link>
      </div>
    </div>
  );
}

export default StubPage;

