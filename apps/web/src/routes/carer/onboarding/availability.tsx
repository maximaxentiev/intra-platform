import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { CarerAvailabilityEditor } from "@/components/carer/CarerAvailabilityEditor";
import { Button } from "@/components/ui/button";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import { stepPathForNumber } from "@/lib/carer-onboarding";
import { carerAvailabilityApi } from "@/lib/carer-availability";
import { currentMondayWeekStart } from "@/lib/carer-availability-dates";

export const Route = createFileRoute("/carer/onboarding/availability")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/availability");
  },
  component: CarerOnboardingAvailabilityPage,
});

function CarerOnboardingAvailabilityPage() {
  const { carer } = Route.useRouteContext();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => currentMondayWeekStart());

  const availability = useQuery({
    queryKey: ["carer-availability", weekStart],
    queryFn: () => carerAvailabilityApi.list(weekStart),
  });

  return (
    <CarerShell
      session={carer}
      title="Availability"
      subtitle="Add the days and times you're available to work."
    >
      <CarerOnboardingShell
        activeStep={3}
        profileCompletedAt={carer.profileCompletedAt}
        onboardingStep={carer.onboardingStep}
        onboardingCompletedAt={carer.onboardingCompletedAt}
      >
        <Button
          asChild
          variant="ghost"
          className="h-10 px-0 text-muted-foreground hover:text-foreground"
        >
          <Link to={stepPathForNumber(2)}>
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
        <CarerAvailabilityEditor
          mode="onboarding"
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          slots={availability.data}
          isLoading={availability.isLoading}
          isFetching={availability.isFetching}
          loadFailed={availability.isError}
          onRefresh={() => availability.refetch()}
          onStepComplete={() => navigate({ to: "/carer", replace: true })}
        />
      </CarerOnboardingShell>
    </CarerShell>
  );
}
