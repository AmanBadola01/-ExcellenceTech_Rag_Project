import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { api, errorMessage, getToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner, type BannerError } from "@/components/ErrorBanner";
import type { ChatMessage } from "@/components/MessageBubble";

type ChatSummary = { id: string; title: string };

export const Route = createFileRoute("/")({
  ssr: false,
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Excellence Q&A RAG" },
      {
        name: "description",
        content: "Ask questions about your document and get answers with cited sources.",
      },
      { property: "og:title", content: "Excellence Q&A RAG" },
      { property: "og:description", content: "Ask questions about your document and get answers with cited sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChatPage() {
  const navigate = useNavigate();
  const { token, email, logout } = useAuth();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<BannerError | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      logout();
      navigate({ to: "/login", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const list = (await api.listChats()) as ChatSummary[];
      setChats(list);
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => loadChats() });
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void loadChats();
  }, [token, loadChats]);

  const openChat = async (id: string) => {
    setError(null);
    setSidebarOpen(false);
    try {
      const history = (await api.getChat(id)) as Array<{ role: string; content: string }>;
      // History has no sources or searched_as — strip extras from loaded messages.
      setMessages(history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      setActiveChat(id);
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => openChat(id) });
    }
  };

  const newChat = async () => {
    setError(null);
    try {
      const created: any = await api.createChat();
      setActiveChat(created.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => void newChat() });
    }
  };

  const receiveAnswer = (reply: any) => {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: reply.answer,
        searched_as: reply.searched_as ?? null,
        sources: reply.sources ?? null,
      },
    ]);
    // Refresh history so a brand-new chat appears at the top.
    void loadChats();
  };

  const send = async (question: string) => {
    setError(null);
    let createdId: string | null = null;
    if (!activeChat) {
      try {
        const created: any = await api.createChat();
        createdId = created.id;
        setActiveChat(created.id);
      } catch (err) {
        setError({ message: errorMessage(err), retry: () => void send(question) });
        return;
      }
    }
    const chatId = activeChat ?? createdId;
    if (!chatId) {
      setError({ message: "Could not start a new chat. Please try again.", retry: () => void send(question) });
      return;
    }
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setTyping(true);
    try {
      const reply = await api.ask(chatId, question);
      receiveAnswer(reply);
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => void resend(chatId, question) });
    } finally {
      setTyping(false);
    }
  };

  const resend = async (chatId: string, question: string) => {
    setError(null);
    setTyping(true);
    try {
      const reply = await api.ask(chatId, question);
      receiveAnswer(reply);
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => void resend(chatId, question) });
    } finally {
      setTyping(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/login", replace: true });
  };

  // Don't render the chat shell while signed out; the effect above redirects.
  if (!token) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chats}
        activeChat={activeChat}
        loading={chatsLoading}
        email={email}
        onNewChat={() => void newChat()}
        onOpenChat={(id) => void openChat(id)}
        onLogout={handleLogout}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-sidebar-foreground">Excellence Q&A RAG</span>
        </div>

        {messages.length === 0 && !typing ? (
          <EmptyState onPick={(question) => void send(question)} />
        ) : (
          <ChatWindow messages={messages} typing={typing} />
        )}

        <div className="border-t border-border bg-background/80 px-4 py-3">
          <div className="mx-auto w-full max-w-[720px]">
            <ErrorBanner
              error={error}
              onRetry={() => {
                const retry = error?.retry;
                setError(null);
                retry?.();
              }}
              onDismiss={() => setError(null)}
            />
            <ChatInput onSend={(text) => void send(text)} disabled={typing} />
          </div>
        </div>
      </main>
    </div>
  );
}
