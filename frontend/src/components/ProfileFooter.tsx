export function ProfileFooter({ email, onLogout }: { email: string | null; onLogout: () => void }) {
  const letter = (email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border px-3 py-3">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      >
        {letter}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-sidebar-foreground" title={email ?? ""}>
        {email ?? "Signed in"}
      </span>
      <button
        type="button"
        onClick={onLogout}
        aria-label="Logout"
        title="Logout"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
