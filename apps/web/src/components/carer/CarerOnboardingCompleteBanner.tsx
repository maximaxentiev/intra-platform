import { CheckCircle2 } from "lucide-react";
import { CARER_ONBOARDING_COMPLETE_BANNER } from "@/lib/carer-onboarding-completion";

export function CarerOnboardingCompleteBanner() {
  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{CARER_ONBOARDING_COMPLETE_BANNER.title}</p>
          <p className="text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/90">
            {CARER_ONBOARDING_COMPLETE_BANNER.message}
          </p>
        </div>
      </div>
    </div>
  );
}
