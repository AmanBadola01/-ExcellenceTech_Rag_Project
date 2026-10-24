import { createFileRoute } from "@tanstack/react-router";

import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · Excellence Q&A RAG" },
      {
        name: "description",
        content: "Sign in to Excellence Q&A RAG to ask questions about your documents.",
      },
      { property: "og:title", content: "Sign in · Excellence Q&A RAG" },
      { property: "og:description", content: "Sign in to Excellence Q&A RAG to ask questions about your documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function LoginPage() {
  return <AuthPage />;
}
