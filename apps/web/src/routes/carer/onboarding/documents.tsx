import { createFileRoute } from "@tanstack/react-router";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { Card, CardContent } from "@/components/ui/card";
import { assertOnboardingStepAccess } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/onboarding/documents")({
  ssr: false,
  beforeLoad: ({ context }) => {
    assertOnboardingStepAccess(context.carer, "/carer/onboarding/documents");
  },
  component: CarerOnboardingDocumentsPage,
});

function CarerOnboardingDocumentsPage() {
  const { carer } = Route.useRouteContext();

  return (
    <CarerShell
      session={carer}
      title="Documents"
      subtitle="Upload certifications and clearances in a future release."
    >
      <CarerOnboardingShell currentStep={2}>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Document uploads are not available yet. Your coordinator will enable this step in a
            later update. You cannot access the full carer portal until all onboarding steps are
            complete.
          </CardContent>
        </Card>
      </CarerOnboardingShell>
    </CarerShell>
  );
}
