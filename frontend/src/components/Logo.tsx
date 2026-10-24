import { Link } from "@tanstack/react-router";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Link
      to="/"
      aria-label="Excellence Q&A RAG home"
      className="logo-glow inline-flex shrink-0 items-center rounded-md focus-visible:outline-none"
    >
      <img
        src="/logo.png"
        alt="Excellence Q&A RAG Logo"
        draggable={false}
        style={{ height: size }}
        className="w-auto object-contain"
      />
    </Link>
  );
}
