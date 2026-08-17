import { createFileRoute, Link, redirect, useRouterState } from "@tanstack/react-router";
import { carerAuthApi } from "@/lib/carer";
import { CARER_ONBOARDING_HUB_PATH, onboardingComplete } from "@/lib/carer-onboarding";
import { readOnboardingJustCompleted } from "@/lib/carer-onboarding-completion";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingCompleteBanner } from "@/components/carer/CarerOnboardingCompleteBanner";
import { CarerAvailabilityDashboardSummary } from "@/components/carer/CarerAvailabilityDashboardSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { carerFullName } from "@/lib/carer";

export const Route = createFileRoute("/carer/")({
  ssr: false,
  beforeLoad: async () => {
    let session;
    try {
      session = await carerAuthApi.session();
    } catch {
      throw redirect({ to: "/carer/login", replace: true });
    }
    if (!onboardingComplete(session)) {
      throw redirect({ to: CARER_ONBOARDING_HUB_PATH, replace: true });
    }
    return { carer: session };
  },
  loader: ({ context }) => context.carer,
  component: CarerHomePage,
});

function CarerHomePage() {
  const carer = Route.useLoaderData();
  const locationState = useRouterState({ select: (s) => s.location.state });
  const showOnboardingCompleteBanner = readOnboardingJustCompleted(locationState);

  return (
    <CarerShell session={carer} title={`Hi ${carer.legalFirstName || "there"}`}>
      <div className="grid gap-4">
        {showOnboardingCompleteBanner ? <CarerOnboardingCompleteBanner /> : null}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-1">
              <div className="font-medium">{carerFullName(carer) || carer.email}</div>
              <div className="text-muted-foreground">{carer.email}</div>
              {carer.phone ? <div className="text-muted-foreground">{carer.phone}</div> : null}
            </div>
            <Link to="/carer/profile" className="font-medium text-primary hover:underline">
              Edit personal information
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link to="/carer/documents" className="font-medium text-primary hover:underline">
              Manage documents
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CarerAvailabilityDashboardSummary />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming shifts</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your assigned shifts will appear here.
          </CardContent>
        </Card>
      </div>
    </CarerShell>
  );
}
