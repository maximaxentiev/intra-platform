import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";
import { stepPathForNumber } from "@/lib/carer-onboarding";

export const Route = createFileRoute("/carer/onboarding/availability")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/availability");
  },
  component: CarerOnboardingAvailabilityPage,
});

function CarerOnboardingAvailabilityPage() {
  const { carer } = Route.useRouteContext();

  return (
    <CarerShell
      session={carer}
      title="Availability"
      subtitle="Set your weekly availability in a future release."
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
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Availability scheduling is not available yet. Complete document uploads when they
            launch, then return here. The full carer portal stays locked until onboarding is
            finished.
          </CardContent>
        </Card>
      </CarerOnboardingShell>
    </CarerShell>
  );
}
