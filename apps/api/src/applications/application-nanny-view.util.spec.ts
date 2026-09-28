import { describe, expect, it } from 'vitest';
import { buildNannyApplicationOpsView } from './application-nanny-view.util';

describe('application-nanny-view.util', () => {
  it('maps legacy nanny rows without v2 snapshot fields', () => {
    const view = buildNannyApplicationOpsView({
      role: 'nanny',
      payloadSnapshot: {},
      preferredName: '',
      city: '',
      postalCode: '',
      accuracyConfirmed: null,
      gtaEligible: true,
      statusInCanada: 'permanent_resident',
      experienceDuration: '2_years',
      nannyExperienceTypes: ['nanny'],
      childcareExperience: '',
      firstAidCprStatus: 'provided',
      firstAidCprExpiry: null,
      vscStatus: 'provided',
      vscIssueOrRequestDate: null,
      englishProficiency: 'fluent',
      nannyTrainingCompleted: true,
      nannyTrainingDescription: 'Workshop',
    } as never);

    expect(view?.intakeVersion).toBe('legacy');
    expect(view?.legacyTraining?.completed).toBe(true);
    expect(view?.eligibility.legallyAuthorizedToWork).toBeNull();
  });

  it('maps nanny v2 payload snapshot fields', () => {
    const view = buildNannyApplicationOpsView({
      role: 'nanny',
      payloadSnapshot: {
        eligibility: { canCommuteGta: true, canadaStatus: 'Toronto' },
        applicant: { city: 'Toronto', postalCode: 'M5V 1A1' },
        languages: { spokenEnglishRating: 9 },
      },
      preferredName: 'Sam',
      city: 'Toronto',
      postalCode: 'M5V 1A1',
      accuracyConfirmed: true,
      gtaEligible: true,
      statusInCanada: 'Toronto',
      experienceDuration: '',
      nannyExperienceTypes: [],
      childcareExperience: '',
      firstAidCprStatus: '',
      firstAidCprExpiry: null,
      vscStatus: '',
      vscIssueOrRequestDate: null,
      englishProficiency: '9',
      nannyTrainingCompleted: null,
      nannyTrainingDescription: '',
    } as never);

    expect(view?.intakeVersion).toBe('nanny_v2');
    expect(view?.languages.spokenEnglishRating).toBe(9);
  });
});
