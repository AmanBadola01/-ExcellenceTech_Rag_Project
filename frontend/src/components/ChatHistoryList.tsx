import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ChatSummary = { id: string; title: string };

function ChatHistoryItem({
  chat,
  isActive,
  onOpen,
}: {
  chat: ChatSummary;
  isActive: boolean;
  onOpen: (id: string) => void;
}) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const measure = () => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      if (textWidth > containerWidth) {
        setScrollDistance(textWidth - containerWidth);
      } else {
        setScrollDistance(0);
      }
    }
  };

  // Measure on mount and whenever the title changes
  useEffect(() => {
    measure();
  }, [chat.title]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleMouseEnter = () => {
    clearTimer();
    measure();
    setIsHovered(true);
    setDirection("forward");
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsHovered(false);
    setDirection("backward");
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLSpanElement>) => {
    // Only respond to transforms on the text element itself
    if (e.target !== textRef.current) return;
    if (!isHovered || scrollDistance === 0) return;

    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setDirection((prev) => (prev === "forward" ? "backward" : "forward"));
    }, 1200); // 1.2s pause at each end so the user can comfortably read
  };

  // Scroll duration at readable pace (~35px/s), minimum 2s
  const duration = Math.max(2, scrollDistance / 35);
  const title = chat.title || "Untitled chat";
  const isScrolling = isHovered && scrollDistance > 0;
  const isAtEnd = isScrolling && direction === "forward";

  return (
    <button
      type="button"
      onClick={() => onOpen(chat.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
      title={title}
    >
      <span
        ref={containerRef}
        className={cn(
          "block w-full overflow-hidden whitespace-nowrap",
          isScrolling ? "text-clip" : "text-ellipsis",
        )}
      >
        <span
          ref={textRef}
          onTransitionEnd={handleTransitionEnd}
          className="inline-block whitespace-nowrap max-w-none"
          style={{
            transform: isAtEnd ? `translateX(-${scrollDistance}px)` : "translateX(0)",
            transitionProperty: "transform",
            transitionTimingFunction: "ease-in-out",
            transitionDuration: isScrolling
              ? `${direction === "forward" ? duration : duration * 0.75}s`
              : "0.25s",
            transitionDelay: isScrolling && direction === "forward" ? "0.35s" : "0s",
          }}
        >
          {title}
        </span>
      </span>
    </button>
  );
}

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
              <ChatHistoryItem
                chat={chat}
                isActive={chat.id === activeChat}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
