import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import {
  accountWeekChoices,
  CarerAvailabilityEditor,
} from "@/components/carer/CarerAvailabilityEditor";
import { Button } from "@/components/ui/button";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";
import { carerAvailabilityApi } from "@/lib/carer-availability";

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
  const [weekStart, setWeekStart] = useState(() => accountWeekChoices().thisWeekStart);

  const availability = useQuery({
    queryKey: ["carer-availability", weekStart],
    queryFn: () => carerAvailabilityApi.list(weekStart),
  });

  function handleWeekStartChange(nextWeekStart: string) {
    const { thisWeekStart, nextWeekStart: allowedNext } = accountWeekChoices();
    if (nextWeekStart === thisWeekStart || nextWeekStart === allowedNext) {
      setWeekStart(nextWeekStart);
    }
  }

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
        weekStart={weekStart}
        onWeekStartChange={handleWeekStartChange}
        slots={availability.data}
        isLoading={availability.isLoading}
        isFetching={availability.isFetching}
        loadFailed={availability.isError}
        onRefresh={() => availability.refetch()}
      />
    </CarerShell>
  );
}
