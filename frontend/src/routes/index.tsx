import { createFileRoute, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (getToken()) {
      throw redirect({ to: "/chat", replace: true });
    } else {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: () => null,
});
