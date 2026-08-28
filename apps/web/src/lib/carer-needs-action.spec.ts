import { describe, expect, it } from "vitest";
import { buildCarerNeedsActionItems } from "./carer-needs-action";
import type { CarerSession } from "./carer";
import type { CarerDocumentCategory, CarerDocumentsList } from "./carer-documents";

function sampleCategory(overrides: Partial<CarerDocumentCategory> = {}): CarerDocumentCategory {
  return {
    documentType: "immunizations",
    required: true,
    isSubmitted: true,
    reviewStatus: "pending_review",
    processedDate: null,
    expiryDate: null,
    expiryDisplay: "no_expiry",
    submittedAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    issueNote: null,
    remindersEnabled: true,
    currentSubmissionId: "sub-1",
    files: [],
    ...overrides,
  };
}

function session(overrides: Partial<CarerSession> = {}): CarerSession {
  return {
    accountId: "acc-1",
    staffId: "staff-1",
    email: "carer@example.com",
    status: "active",
    onboardingStep: 3,
    profileCompletedAt: "2026-01-01T00:00:00.000Z",
    documentsCompletedAt: "2026-01-01T00:00:00.000Z",
    availabilityCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    profileComplete: true,
    documentsComplete: true,
    availabilityComplete: true,
    onboardingComplete: true,
    canCompleteOnboarding: false,
    legalFirstName: "Jaspreet",
    legalLastName: "Singh",
    phone: "",
    address: "",
    city: "",
    ...overrides,
  };
}

function documents(categories: CarerDocumentsList["categories"]): CarerDocumentsList {
  return {
    staffRole: "ECE",
    categories,
    documentsCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingStep: 3,
    canCompleteStep2: true,
    documentStatus: "approved",
    shiftEligible: true,
    shiftEligibilityReasons: [],
  };
}

describe("buildCarerNeedsActionItems", () => {
  it("prompts incomplete onboarding before document checks", () => {
    const items = buildCarerNeedsActionItems(
      session({ onboardingComplete: false, onboardingCompletedAt: null }),
      undefined,
    );
    expect(items).toEqual([
      {
        id: "onboarding-incomplete",
        label: "Finish setting up your account",
        href: "/carer/onboarding/intro",
      },
    ]);
  });

  it("flags missing, issue-flagged, and expired required documents", () => {
    const items = buildCarerNeedsActionItems(
      session(),
      documents([
        sampleCategory({
          documentType: "immunizations",
          required: true,
          isSubmitted: false,
          reviewStatus: "not_submitted",
        }),
        sampleCategory({
          documentType: "first_aid_cpr",
          required: true,
          reviewStatus: "issue_flagged",
        }),
        sampleCategory({
          documentType: "vulnerable_sector_check",
          required: true,
          expiryDisplay: "expired",
        }),
        sampleCategory({
          documentType: "covid19_vaccination",
          required: false,
          isSubmitted: false,
        }),
      ]),
    );

    expect(items.map((item) => item.label)).toEqual([
      "Renew Vulnerable Sector Check",
      "Update First Aid & CPR Certification",
      "Upload Immunizations",
    ]);
    expect(items.every((item) => item.href === "/carer/documents")).toBe(true);
  });

  it("returns no items when onboarding is complete and documents are current", () => {
    const items = buildCarerNeedsActionItems(
      session(),
      documents([
        sampleCategory({ documentType: "immunizations", reviewStatus: "approved" }),
        sampleCategory({ documentType: "first_aid_cpr", reviewStatus: "approved" }),
        sampleCategory({
          documentType: "vulnerable_sector_check",
          reviewStatus: "approved",
          expiryDisplay: "current",
        }),
        sampleCategory({
          documentType: "covid19_vaccination",
          required: false,
          isSubmitted: false,
        }),
      ]),
    );
    expect(items).toEqual([]);
  });
});
