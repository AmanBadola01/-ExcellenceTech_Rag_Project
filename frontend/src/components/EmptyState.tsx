const SUGGESTED_QUESTIONS = [
  "How many leaves are allowed?",
  "What are the working hours?",
  "How long is maternity leave?",
  "What is the annual learning budget?",
];

export function EmptyState({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <h1 className="font-serif text-3xl text-foreground">What would you like to know?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask a question about your document, or start with one of these.
      </p>
      <div className="mt-6 grid w-full max-w-[720px] gap-3 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="rounded-xl border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-colors duration-200 hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
