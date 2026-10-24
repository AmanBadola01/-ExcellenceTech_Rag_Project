export function SearchedAsNote({ value }: { value: string | null | undefined }) {
  if (value == null) return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Searched as: <span className="italic">{value}</span>
    </p>
  );
}
