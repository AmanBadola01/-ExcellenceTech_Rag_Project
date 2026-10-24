import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewChatButton } from "@/components/NewChatButton";
import { ChatHistoryList } from "@/components/ChatHistoryList";
import { ProfileFooter } from "@/components/ProfileFooter";
import { cn } from "@/lib/utils";

type ChatSummary = { id: string; title: string };

export function Sidebar({
  open,
  onClose,
  chats,
  activeChat,
  loading,
  email,
  onNewChat,
  onOpenChat,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  chats: ChatSummary[];
  activeChat: string | null;
  loading: boolean;
  email: string | null;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onLogout: () => void;
}) {
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
        <div className="flex items-center gap-2 px-4 pb-3 pt-4">
          <Logo size={32} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground">
            Excellence Q&A RAG
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
        <div className="px-3 pb-1">
          <NewChatButton onClick={onNewChat} />
        </div>
        <ChatHistoryList chats={chats} activeChat={activeChat} loading={loading} onOpen={onOpenChat} />
        <ProfileFooter email={email} onLogout={onLogout} />
      </aside>
    </>
  );
}
