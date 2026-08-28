import { createFileRoute } from "@tanstack/react-router";
import { CarerBackButton } from "@/components/carer/CarerBackButton";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerAvailabilityManager } from "@/components/carer/CarerAvailabilityManager";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/availability")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForPortal();
    return { carer };
  },
  component: CarerAccountAvailabilityPage,
});

function CarerAccountAvailabilityPage() {
  const { carer } = Route.useRouteContext();

  return (
    <CarerShell session={carer} title="Availability">
      <div className="mb-4">
        <CarerBackButton to="/carer" label="Back to portal" />
      </div>
      <CarerAvailabilityManager />
    </CarerShell>
  );
}
