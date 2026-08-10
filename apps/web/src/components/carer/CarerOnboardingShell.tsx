import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { CARER_ONBOARDING_STEPS } from "@/lib/carer-onboarding";

type StepState = "complete" | "current" | "locked";

const STATE_LABEL: Record<StepState, string> = {
  complete: "Completed",
  current: "In progress",
  locked: "Locked",
};

/**
 * Progress chrome for the three-step carer onboarding wizard.
 * Presentation only — route guards remain the source of truth for access.
 */
export function CarerOnboardingShell({
  currentStep,
  children,
}: {
  currentStep: number;
  children: ReactNode;
}) {
  const total = CARER_ONBOARDING_STEPS.length;
  const percent = Math.round(((currentStep - 1) / total) * 100);

  return (
    <div className="space-y-6 min-w-0">
      <nav aria-label="Onboarding progress" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">
            Step {currentStep} of {total}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentStep - 1} of {total} steps completed
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
            const state: StepState =
              s.step < currentStep ? "complete" : s.step === currentStep ? "current" : "locked";
            return (
              <li
                key={s.step}
                aria-current={state === "current" ? "step" : undefined}
                className={[
                  "flex min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                  state === "current"
                    ? "border-primary/60 bg-primary/5 shadow-sm"
                    : state === "complete"
                      ? "border-border/70 bg-card"
                      : "border-dashed border-border/70 bg-muted/30",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    state === "current"
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
                      state === "current" ? "font-semibold text-foreground" : "text-foreground/90"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {STATE_LABEL[state]}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </div>
  );
}
