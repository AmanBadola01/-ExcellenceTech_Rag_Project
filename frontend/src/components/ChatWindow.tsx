import { useEffect, useRef } from "react";

import { MessageBubble, type ChatMessage } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";

export function ChatWindow({ messages, typing }: { messages: ChatMessage[]; typing: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8">
        {messages.map((message, i) => (
          <MessageBubble key={i} message={message} />
        ))}
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
