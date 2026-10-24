export type BannerError = { message: string; retry?: () => void };

export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: BannerError | null;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span className="min-w-0 flex-1 truncate" title={error.message}>
        {error.message}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {error.retry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md px-2 py-1 text-xs font-semibold text-destructive transition-colors duration-150 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-150 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>
  );
}
