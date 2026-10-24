import ReactMarkdown from "react-markdown";

import { SearchedAsNote } from "@/components/SearchedAsNote";
import { SourceCards } from "@/components/SourceCards";

export const NOT_FOUND_ANSWER = "I couldn't find this information in the document.";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  searched_as?: string | null;
  sources?: Array<{ text: string; score: number }> | null;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end">
        <span className="mb-1 text-xs font-semibold text-muted-foreground">User</span>
        <div className="max-w-[85%] rounded-xl bg-user-bubble px-4 py-3 text-sm leading-relaxed text-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const notFound = message.content === NOT_FOUND_ANSWER;

  return (
    <div className="flex flex-col">
      <span className="mb-1 text-xs font-semibold text-muted-foreground">Assistant</span>
      {notFound ? (
        <p className="text-sm italic leading-relaxed text-muted-foreground">{message.content}</p>
      ) : (
        <div className="prose-chat text-sm leading-relaxed text-foreground">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}
      <SearchedAsNote value={message.searched_as} />
      <SourceCards sources={message.sources} />
    </div>
  );
}
