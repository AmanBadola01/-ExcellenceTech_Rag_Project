export function TypingIndicator() {
  return (
    <div className="flex flex-col gap-1" role="status" aria-label="Assistant is typing">
      <span className="text-xs font-semibold text-muted-foreground">Assistant</span>
      <div className="flex items-center gap-1.5 py-1" aria-hidden="true">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
