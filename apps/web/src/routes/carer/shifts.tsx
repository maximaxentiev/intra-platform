import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerShiftsManager } from "@/components/carer/CarerShiftsManager";
import { Button } from "@/components/ui/button";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/shifts")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForPortal();
    return { carer };
  },
  component: CarerShiftsPage,
});

function CarerShiftsPage() {
  const { carer } = Route.useRouteContext();

  return (
    <CarerShell
      session={carer}
      title="Shifts"
      subtitle="View your upcoming and previous assigned shifts."
    >
      <div className="mb-4">
        <Button asChild variant="ghost" className="h-11 min-h-11 px-0 text-muted-foreground hover:text-foreground">
          <Link to="/carer">
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to portal
          </Link>
        </Button>
      </div>
      <CarerShiftsManager />
    </CarerShell>
  );
}
