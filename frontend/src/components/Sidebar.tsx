import { useRouter } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewChatButton } from "@/components/NewChatButton";
import { ChatHistoryList } from "@/components/ChatHistoryList";
import { ProfileFooter } from "@/components/ProfileFooter";
import { cn } from "@/lib/utils";

type ChatSummary = { id: string; title: string };

type Mode = "qa" | "studio" | "ocr";

// ── Studio nav items ────────────────────────────────────────────────────────
const STUDIO_NAV = [
  {
    label: "Projects",
    to: "/studio/projects",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: "Brand voices",
    to: "/studio/brand-voices",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    label: "Company settings",
    to: "/studio/company",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

export function Sidebar({
  open,
  onClose,
  mode,
  // QA-mode props
  chats = [],
  activeChat = null,
  loading = false,
  onNewChat,
  onOpenChat,
  // shared
  email,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  chats?: ChatSummary[];
  activeChat?: string | null;
  loading?: boolean;
  onNewChat?: () => void;
  onOpenChat?: (id: string) => void;
  email: string | null;
  onLogout: () => void;
}) {
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  const switchTo = (target: Mode) => {
    if (target === "qa") {
      void router.navigate({ to: "/chat" });
    } else if (target === "studio") {
      void router.navigate({ to: "/studio/projects" });
    } else {
      void router.navigate({ to: "/ocr" });
    }
    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/25 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:shrink-0 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Sidebar"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <Logo size={32} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground">
            {mode === "qa" ? "Excellence Q&A RAG" : "AI Content Studio"}
          </span>
          <ThemeToggle />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Mode switcher ── */}
        <div className="px-3 pb-3">
          <div className="flex rounded-lg bg-sidebar-accent p-1 gap-1">
            <button
              type="button"
              onClick={() => switchTo("qa")}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-center",
                mode === "qa"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Q&amp;A
            </button>
            <button
              type="button"
              onClick={() => switchTo("studio")}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-center",
                mode === "studio"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => switchTo("ocr")}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-center",
                mode === "ocr"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              OCR
            </button>
          </div>
        </div>

        {/* ── Q&A content ── */}
        {mode === "qa" && (
          <>
            <div className="px-3 pb-1">
              <NewChatButton onClick={onNewChat ?? (() => {})} />
            </div>
            <ChatHistoryList
              chats={chats}
              activeChat={activeChat}
              loading={loading}
              onOpen={onOpenChat ?? (() => {})}
            />
          </>
        )}

        {/* ── Studio content ── */}
        {mode === "studio" && (
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-2">
            {/* Generate content CTA */}
            <a
              href="/studio/generate"
              onClick={(e) => {
                e.preventDefault();
                void router.navigate({ to: "/studio/generate" });
                onClose();
              }}
              className="mb-2 flex items-center justify-center gap-2 rounded-md bg-[hsl(var(--sidebar-primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--sidebar-primary-foreground))] transition-opacity hover:opacity-90"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Generate content
            </a>

            {/* Nav links */}
            <nav className="flex flex-col gap-0.5">
              {STUDIO_NAV.map(({ label, to, icon }) => {
                const active = currentPath === to || currentPath.startsWith(to + "/");
                return (
                  <a
                    key={to}
                    href={to}
                    onClick={(e) => {
                      e.preventDefault();
                      void router.navigate({ to: to as any });
                      onClose();
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    )}
                  >
                    {icon}
                    {label}
                  </a>
                );
              })}
            </nav>
          </div>
        )}

        <ProfileFooter email={email} onLogout={onLogout} />
      </aside>
    </>
  );
}
