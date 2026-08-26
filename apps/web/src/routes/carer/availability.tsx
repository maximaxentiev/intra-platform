import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerAvailabilityManager } from "@/components/carer/CarerAvailabilityManager";
import { Button } from "@/components/ui/button";
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
    <CarerShell
      session={carer}
      title="Availability"
      subtitle="Tell Intra when you can work."
    >
      <div className="mb-4">
        <Button asChild variant="ghost" className="h-11 min-h-11 px-0 text-muted-foreground hover:text-foreground">
          <Link to="/carer">
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to portal
          </Link>
        </Button>
      </div>
      <CarerAvailabilityManager />
    </CarerShell>
  );
}
