import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerAvailabilityEditor } from "@/components/carer/CarerAvailabilityEditor";
import { Button } from "@/components/ui/button";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";
import { carerAvailabilityApi } from "@/lib/carer-availability";
import { currentMondayWeekStart } from "@/lib/carer-availability-dates";

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
  const [weekStart, setWeekStart] = useState(() => currentMondayWeekStart());

  const availability = useQuery({
    queryKey: ["carer-availability", weekStart],
    queryFn: () => carerAvailabilityApi.list(weekStart),
  });

  return (
    <CarerShell
      session={carer}
      title="Your availability"
      subtitle="Manage the days and times you're available to work."
    >
      <div className="mb-4">
        <Button asChild variant="ghost" className="h-10 px-0 text-muted-foreground hover:text-foreground">
          <Link to="/carer">
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to portal
          </Link>
        </Button>
      </div>
      <CarerAvailabilityEditor
        mode="account"
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        slots={availability.data}
        isLoading={availability.isLoading}
        isFetching={availability.isFetching}
        loadFailed={availability.isError}
        onRefresh={() => availability.refetch()}
      />
    </CarerShell>
  );
}
