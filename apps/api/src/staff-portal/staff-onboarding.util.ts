import type { Staff } from '../db/schema';

export const ONBOARDING_STEP = {
  personalInfo: 1,
  documents: 2,
  availability: 3,
} as const;

export function step1RequiredFieldIssues(person: Pick<
  Staff,
  'legalFirstName' | 'legalLastName' | 'email' | 'phone' | 'address' | 'city'
>): string[] {
  const issues: string[] = [];
  if (!person.legalFirstName.trim()) issues.push('legalFirstName');
  if (!person.legalLastName.trim()) issues.push('legalLastName');
  if (!person.email.trim()) issues.push('email');
  if (!person.phone.trim()) issues.push('phone');
  if (!person.address.trim()) issues.push('address');
  if (!person.city.trim()) issues.push('city');
  return issues;
}

/** Highest onboarding URL step the account may open (1–3). */
export function maxAccessibleOnboardingStep(account: {
  profileCompletedAt: Date | null;
  onboardingStep: number;
}): number {
  if (!account.profileCompletedAt) return ONBOARDING_STEP.personalInfo;
  return Math.max(ONBOARDING_STEP.documents, Math.min(account.onboardingStep, ONBOARDING_STEP.availability));
}
