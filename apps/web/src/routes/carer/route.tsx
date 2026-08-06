import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CarerPortalUnavailable } from "@/components/carer/CarerPortalUnavailable";
import { isCarerPortalEnabled } from "@/lib/carer-portal-flag";
import { carerPortalParentBehavior } from "@/lib/carer-portal-routing";

export const Route = createFileRoute("/carer")({
  ssr: false,
  component: CarerLayout,
});

function CarerLayout() {
  const behavior = carerPortalParentBehavior(isCarerPortalEnabled());
  if (behavior === "show-unavailable") {
    return <CarerPortalUnavailable />;
  }
  return <Outlet />;
}
