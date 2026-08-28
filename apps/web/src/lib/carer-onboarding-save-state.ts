/** Shared onboarding forward-button label while persistence is in flight. */
export const ONBOARDING_SAVING_CHANGES_LABEL = "Saving changes";

/** Step 2 note when requirements are incomplete after persistence has settled. */
export const ONBOARDING_STEP_2_REQUIRED_FIELDS_NOTE =
  "There are still required fields that need attention.";

export type CarerOnboardingStep2State = {
  saving: boolean;
  requirementsComplete: boolean;
  showRequiredFieldsNote: boolean;
};
