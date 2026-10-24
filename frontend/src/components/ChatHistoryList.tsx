import { cn } from "@/lib/utils";

type ChatSummary = { id: string; title: string };

export function ChatHistoryList({
  chats,
  activeChat,
  loading,
  onOpen,
}: {
  chats: ChatSummary[];
  activeChat: string | null;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Chat history
      </p>
      {loading ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Loading…</p>
      ) : chats.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">No chats yet</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => onOpen(chat.id)}
                aria-current={chat.id === activeChat ? "true" : undefined}
                className={cn(
                  "w-full truncate rounded-md px-2 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  chat.id === activeChat
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
                title={chat.title || "Untitled chat"}
              >
                {chat.title || "Untitled chat"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
