import { describe, expect, it } from 'vitest';
import { maxAccessibleOnboardingStep, step1RequiredFieldIssues } from './staff-onboarding.util';

describe('step1RequiredFieldIssues', () => {
  it('flags empty required fields', () => {
    expect(
      step1RequiredFieldIssues({
        legalFirstName: '',
        legalLastName: 'X',
        email: 'a@b.c',
        phone: '1',
        address: '1',
        city: 'C',
      }),
    ).toContain('legalFirstName');
  });
});

describe('maxAccessibleOnboardingStep', () => {
  it('locks to step 1 until profile is complete', () => {
    expect(
      maxAccessibleOnboardingStep({ profileCompletedAt: null, onboardingStep: 1 }),
    ).toBe(1);
  });

  it('allows documents after profile completion', () => {
    expect(
      maxAccessibleOnboardingStep({
        profileCompletedAt: new Date(),
        onboardingStep: 2,
      }),
    ).toBe(2);
  });
});
