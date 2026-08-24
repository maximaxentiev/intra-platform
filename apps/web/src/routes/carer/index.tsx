import type { ReactNode } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, FileText, User } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerOnboardingCompleteBanner } from "@/components/carer/CarerOnboardingCompleteBanner";
import { CarerAvailabilityDashboardSummary } from "@/components/carer/CarerAvailabilityDashboardSummary";
import { CarerShiftsDashboardSummary } from "@/components/carer/CarerShiftsDashboardSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { carerFullName } from "@/lib/carer";
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
      subtitle="Here's what's coming up and what needs your attention."
    >
      <div className="grid gap-4">
        {showOnboardingCompleteBanner ? <CarerOnboardingCompleteBanner /> : null}

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming shifts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CarerShiftsDashboardSummary />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CarerAvailabilityDashboardSummary />
          </CardContent>
        </Card>

        <section aria-label="Your account" className="grid gap-3 sm:grid-cols-2">
          <QuickLinkCard
            to="/carer/documents"
            icon={<FileText aria-hidden="true" className="h-4 w-4" />}
            title="Documents"
            description="Upload and keep your compliance documents current."
          />
          <QuickLinkCard
            to="/carer/profile"
            icon={<User aria-hidden="true" className="h-4 w-4" />}
            title="Personal information"
            description={carerFullName(carer) || carer.email}
          />
          <QuickLinkCard
            to="/carer/availability"
            icon={<CalendarDays aria-hidden="true" className="h-4 w-4" />}
            title="Update availability"
            description="Tell us the days and times you can work."
          />
        </section>
      </div>
    </CarerShell>
  );
}

function QuickLinkCard({
  to,
  icon,
  title,
  description,
}: {
  to: "/carer/documents" | "/carer/profile" | "/carer/availability";
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-16 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-xs transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{description}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
