import { createFileRoute } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingCompleteBanner } from "@/components/carer/CarerOnboardingCompleteBanner";
import { CarerAvailabilityDashboardSummary } from "@/components/carer/CarerAvailabilityDashboardSummary";
import { CarerNeedsActionSummary } from "@/components/carer/CarerNeedsActionSummary";
import { CarerShiftsDashboardSummary } from "@/components/carer/CarerShiftsDashboardSummary";
import { carerGreeting } from "@/lib/carer-portal-nav";
import { readOnboardingJustCompleted } from "@/lib/carer-onboarding-completion";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForPortal();
    return { carer };
  },
  loader: ({ context }) => context.carer,
  component: CarerHomePage,
});

function CarerHomePage() {
  const carer = Route.useLoaderData();
  const locationState = useRouterState({ select: (s) => s.location.state });
  const showOnboardingCompleteBanner = readOnboardingJustCompleted(locationState);

  return (
    <CarerShell
      session={carer}
      title={carerGreeting(carer.legalFirstName)}
      subtitle="Here's what's coming up."
    >
      <div className="space-y-6">
        {showOnboardingCompleteBanner ? <CarerOnboardingCompleteBanner /> : null}

        <CarerNeedsActionSummary session={carer} />

        <section aria-labelledby="home-upcoming-shifts">
          <h2 id="home-upcoming-shifts" className="mb-2 text-base font-semibold text-foreground">
            Upcoming shifts
          </h2>
          <CarerShiftsDashboardSummary />
        </section>

        <section aria-labelledby="home-availability">
          <h2 id="home-availability" className="mb-2 text-base font-semibold text-foreground">
            Availability
          </h2>
          <CarerAvailabilityDashboardSummary />
        </section>
      </div>
    </CarerShell>
  );
}
