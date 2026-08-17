import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import {
  CARER_ONBOARDING_STEPS,
  isOnboardingStepNavigable,
} from "@/lib/carer-onboarding";
import type { CarerSession } from "@/lib/carer";
import {
  countCompletedOnboardingSteps,
  onboardingStepStateLabel,
  resolveOnboardingStepDisplayState,
  type OnboardingProgressContext,
} from "@/lib/carer-onboarding-progress";

function stepItemClassName(isViewing: boolean, state: string): string {
  return [
    "flex min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
    isViewing
      ? "border-primary/60 bg-primary/5 shadow-sm"
      : state === "complete"
        ? "border-border/70 bg-card hover:bg-muted/40"
        : state === "locked"
          ? "border-dashed border-border/70 bg-muted/30"
          : "border-border/70 bg-card hover:bg-muted/40",
  ].join(" ");
}

/**
 * Progress chrome for the three-step carer onboarding wizard.
 * Route guards remain the source of truth for access; unlocked steps link backward/forward within range.
 */
export function CarerOnboardingShell({
  activeStep,
  session,
  children,
}: {
  activeStep: number;
  session: Pick<
    CarerSession,
    | "profileComplete"
    | "documentsComplete"
    | "availabilityComplete"
    | "profileCompletedAt"
    | "onboardingStep"
  >;
  children: ReactNode;
}) {
  const ctx: OnboardingProgressContext = {
    activeStep,
    profileComplete: session.profileComplete,
    documentsComplete: session.documentsComplete,
    availabilityComplete: session.availabilityComplete,
    profileCompletedAt: session.profileCompletedAt,
    onboardingStep: session.onboardingStep,
  };
  const navSession = { profileCompletedAt: session.profileCompletedAt, onboardingStep: session.onboardingStep };
  const total = CARER_ONBOARDING_STEPS.length;
  const completedCount = countCompletedOnboardingSteps(session);
  const percent = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-6 min-w-0">
      <nav aria-label="Onboarding progress" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">
            Step {activeStep} of {total}
          </p>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {total} steps complete
          </p>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Onboarding completion"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="grid gap-2 sm:grid-cols-3">
          {CARER_ONBOARDING_STEPS.map((s) => {
            const state = resolveOnboardingStepDisplayState(s.step, ctx);
            const label = onboardingStepStateLabel(state, s.step, activeStep);
            const isViewing = s.step === activeStep;
            const navigable = isOnboardingStepNavigable(s.step, activeStep, navSession);
            const itemClass = stepItemClassName(isViewing, state);

            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    isViewing
                      ? "bg-primary text-primary-foreground"
                      : state === "complete"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {state === "complete" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : state === "locked" ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    s.step
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm ${
                      isViewing ? "font-semibold text-foreground" : "text-foreground/90"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{label}</span>
                </span>
              </>
            );

            if (navigable) {
              return (
                <li key={s.step}>
                  <Link
                    to={s.path}
                    className={`${itemClass} block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                    aria-label={`Go to ${s.title}`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }

            return (
              <li
                key={s.step}
                aria-current={isViewing ? "step" : undefined}
                aria-disabled={state === "locked" ? true : undefined}
                className={itemClass}
                title={state === "locked" ? "Complete previous steps first" : undefined}
              >
                {inner}
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </div>
  );
}
