import { createFileRoute } from "@tanstack/react-router";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerShiftDetail, CarerShiftDetailBackLink } from "@/components/carer/CarerShiftDetail";

export const Route = createFileRoute("/carer/shifts/$id")({
  component: CarerShiftDetailPage,
});

function CarerShiftDetailPage() {
  const { carer } = Route.useRouteContext();
  const { id } = Route.useParams();

  return (
    <CarerShell session={carer} title="Shift details">
      <div className="mb-4">
        <CarerShiftDetailBackLink />
      </div>
      <CarerShiftDetail shiftId={id} />
    </CarerShell>
  );
}
