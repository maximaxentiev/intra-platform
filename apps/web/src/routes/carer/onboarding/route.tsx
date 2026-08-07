import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireCarerSessionForOnboarding } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForOnboarding();
    return { carer };
  },
  component: () => <Outlet />,
});
