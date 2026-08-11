import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, FileText } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingShell } from "@/components/carer/CarerOnboardingShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      subtitle="The next step in your onboarding — coming soon."
    >
      <CarerOnboardingShell
        activeStep={2}
        profileCompletedAt={carer.profileCompletedAt}
        onboardingStep={carer.onboardingStep}
        onboardingCompletedAt={carer.onboardingCompletedAt}
      >
        <div className="space-y-3">
          <Button asChild variant="ghost" className="h-10 px-0 text-muted-foreground hover:text-foreground">
            <Link to="/carer/onboarding/profile">
              <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Personal Information
            </Link>
          </Button>
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Personal information is complete.</span> Thanks — that
              part is done.
            </span>
          </p>

          <Card>
            <CardHeader className="gap-1 pb-3">
              <div className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                >
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base">Documents is your next step</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You will upload your certifications and clearances here.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-muted-foreground">
                <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This step is not available yet in the current build. There is nothing for you to
                  do right now — we will let you know as soon as uploads open.
                </span>
              </p>
              <p className="text-muted-foreground">
                Availability stays locked until documents are finished, and the full carer portal
                unlocks once every onboarding step is complete.
              </p>
            </CardContent>
          </Card>
        </div>
      </CarerOnboardingShell>
    </CarerShell>
  );
}
