import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        className={[
          "rounded-xl border p-4 shadow-xs sm:p-5",
          canFinish
            ? "border-primary/30 bg-primary/5"
            : "border-border/70 bg-card",
        ].join(" ")}
      >
        <h2 id="onboarding-incomplete-heading" className="text-base font-semibold text-foreground">
          {canFinish ? "You're ready to finish setup" : "Onboarding not complete"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {canFinish
            ? "All three steps are complete. Finish onboarding to activate your account and start receiving shift opportunities."
            : "Finish these three steps to set up your account and start receiving shift opportunities."}
        </p>

        <div className="mt-4 space-y-2" aria-label="Onboarding progress">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {completedCount} of {totalSteps} steps complete
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">{percent}%</p>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
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
        </div>
      </section>

      <ol className="grid gap-2.5">
        {steps.map((step) => (
          <HubStepCard key={step.step} step={step} />
        ))}
      </ol>

      <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs">
        {!canFinish ? (
          <p className="text-sm text-muted-foreground">
            Complete all three steps before finishing onboarding.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            All steps are done — finish onboarding to activate your account.
          </p>
        )}
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
  const locked = step.lockedReason !== null;

  const marker = (
    <span
      aria-hidden="true"
      className={[
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
        step.complete
          ? "bg-primary text-primary-foreground"
          : locked
            ? "bg-muted text-muted-foreground"
            : "border border-primary/40 bg-primary/10 text-primary",
      ].join(" ")}
    >
      {step.complete ? (
        <Check className="h-4 w-4" />
      ) : locked ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        step.step
      )}
    </span>
  );

  const body = (
    <>
      {marker}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {step.label}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">{step.title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">
          {locked ? step.lockedReason : step.complete ? "Complete" : step.ctaLabel}
        </span>
      </span>
      {!locked ? (
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : null}
    </>
  );

  const base =
    "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left shadow-xs transition-colors";

  return (
    <li>
      {locked ? (
        <div
          aria-disabled="true"
          className={`${base} border-dashed border-border/70 bg-muted/30`}
        >
          {body}
        </div>
      ) : (
        <Link
          to={step.path}
          aria-label={step.ctaLabel}
          className={`${base} border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
        >
          {body}
        </Link>
      )}
    </li>
  );
}
