import { createFileRoute } from "@tanstack/react-router";
import { CarerBackButton } from "@/components/carer/CarerBackButton";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerShiftsManager } from "@/components/carer/CarerShiftsManager";

export const Route = createFileRoute("/carer/shifts/")({
  component: CarerShiftsPage,
});

function CarerShiftsPage() {
  const { carer } = Route.useRouteContext();

  return (
    <CarerShell session={carer} title="Shifts">
      <div className="mb-4">
        <CarerBackButton to="/carer" label="Back to portal" />
      </div>
      <CarerShiftsManager />
    </CarerShell>
  );
}
