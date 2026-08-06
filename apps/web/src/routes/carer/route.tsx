import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isCarerPortalEnabled } from "@/lib/carer-portal-flag";

export const Route = createFileRoute("/carer")({
  ssr: false,
  beforeLoad: () => {
    if (!isCarerPortalEnabled()) {
      throw redirect({ to: "/auth", replace: true });
    }
  },
  component: () => <Outlet />,
});
