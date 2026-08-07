import type { ReactNode } from "react";
import { CARER_ONBOARDING_STEPS } from "@/lib/carer-onboarding";

export function CarerOnboardingShell({
  currentStep,
  children,
}: {
  currentStep: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <nav aria-label="Onboarding progress" className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Step {currentStep} of {CARER_ONBOARDING_STEPS.length}
        </p>
        <ol className="grid gap-2">
          {CARER_ONBOARDING_STEPS.map((s) => {
            const state =
              s.step < currentStep ? "complete" : s.step === currentStep ? "current" : "upcoming";
            return (
              <li
                key={s.step}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  state === "current"
                    ? "border-primary/50 bg-primary/5 font-medium"
                    : state === "complete"
                      ? "border-border/60 text-muted-foreground"
                      : "border-border/40 text-muted-foreground opacity-80"
                }`}
              >
                <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                  Step {s.step}
                </span>
                {s.title}
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </div>
  );
}
