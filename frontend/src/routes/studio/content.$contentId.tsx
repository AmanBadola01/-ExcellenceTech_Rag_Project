import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/studio/content/$contentId")({
  ssr: false,
  component: () => <Outlet />,
});
