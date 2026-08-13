import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { carerAuthApi } from "@/lib/carer";
import { carerOnboardingResumePath, onboardingComplete } from "@/lib/carer-onboarding";
import { CarerShell } from "@/components/carer/CarerShell";
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
      throw redirect({ to: carerOnboardingResumePath(session), replace: true });
    }
    return { carer: session };
  },
  loader: ({ context }) => context.carer,
  component: CarerHomePage,
});

function CarerHomePage() {
  const carer = Route.useLoaderData();

  return (
    <CarerShell session={carer} title={`Hi ${carer.legalFirstName || "there"}`}>
      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-medium">{carerFullName(carer) || carer.email}</div>
            <div className="text-muted-foreground">{carer.email}</div>
            {carer.phone ? <div className="text-muted-foreground">{carer.phone}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link to="/carer/documents" className="font-medium text-primary hover:underline">
              Manage your compliance documents
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Manage the days and times you&apos;re available to work.</p>
            <Link to="/carer/availability" className="font-medium text-primary hover:underline">
              Manage availability
            </Link>
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
