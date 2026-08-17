/** Transient router location state after guided onboarding completion. */
export type CarerOnboardingCompletionLocationState = {
  onboardingJustCompleted?: true;
};

export const CARER_ONBOARDING_JUST_COMPLETED_STATE: CarerOnboardingCompletionLocationState = {
  onboardingJustCompleted: true,
};

export const CARER_ONBOARDING_COMPLETE_BANNER = {
  title: "Onboarding complete",
  message:
    "You're all set and ready to receive shift opportunities. Keep your availability up to date so our team knows when you're available to work.",
} as const;

export function readOnboardingJustCompleted(
  state: unknown,
): state is CarerOnboardingCompletionLocationState & { onboardingJustCompleted: true } {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as CarerOnboardingCompletionLocationState).onboardingJustCompleted === true
  );
}
