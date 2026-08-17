import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CarerSession } from "@/lib/carer";
import {
  buildHubStepCards,
  countCompletedHubSteps,
  type HubStepCardModel,
} from "@/lib/carer-onboarding-hub";

type CarerOnboardingHubProps = {
  session: CarerSession;
  completing?: boolean;
  completeError?: string | null;
  onCompleteOnboarding?: () => void;
};

export function CarerOnboardingHub({
  session,
  completing = false,
  completeError = null,
  onCompleteOnboarding,
}: CarerOnboardingHubProps) {
  const steps = buildHubStepCards(session);
  const completedCount = countCompletedHubSteps(session);
  const totalSteps = 3;
  const percent = Math.round((completedCount / totalSteps) * 100);
  const canFinish = session.canCompleteOnboarding && !session.onboardingComplete;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="onboarding-incomplete-heading"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4"
      >
        <h2 id="onboarding-incomplete-heading" className="text-base font-semibold text-foreground">
          Onboarding not complete
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete all three steps to finish setting up your account and begin receiving shift
          opportunities.
        </p>
      </section>

      <section aria-label="Onboarding progress" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">
            {completedCount} of {totalSteps} steps complete
          </p>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Onboarding steps completed"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <ol className="grid gap-3">
        {steps.map((step) => (
          <HubStepCard key={step.step} step={step} />
        ))}
      </ol>

      <section className="space-y-3 border-t pt-4">
        {!canFinish ? (
          <p className="text-sm text-muted-foreground">
            Complete all three steps before finishing onboarding.
          </p>
        ) : null}
        {completeError ? (
          <p className="text-sm text-destructive" role="alert" aria-live="polite">
            {completeError}
          </p>
        ) : null}
        <Button
          type="button"
          className="h-11 w-full"
          disabled={!canFinish || completing}
          onClick={onCompleteOnboarding}
        >
          {completing ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              Completing onboarding...
            </>
          ) : (
            "Complete onboarding"
          )}
        </Button>
      </section>
    </div>
  );
}

function HubStepCard({ step }: { step: HubStepCardModel }) {
  const statusLabel = step.complete ? "Complete" : "Needs completion";
  const locked = step.lockedReason !== null;

  return (
    <li>
      <Card className={step.complete ? "border-primary/20" : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {step.label}
              </p>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </div>
            <span
              className={[
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                step.complete
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {step.complete ? (
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              ) : (
                <CircleDashed aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {statusLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {locked ? (
            <p className="mb-3 text-sm text-muted-foreground">{step.lockedReason}</p>
          ) : null}
          {locked ? (
            <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled>
              {step.ctaLabel}
            </Button>
          ) : (
            <Button asChild className="h-11 w-full sm:w-auto">
              <Link to={step.path}>{step.ctaLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
