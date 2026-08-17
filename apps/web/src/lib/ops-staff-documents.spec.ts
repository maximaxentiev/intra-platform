import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  buildOpsCategorySaveFormData,
  isStaleSubmissionError,
  mapOpsDocumentsApiError,
  opsStaffDocumentContentPath,
  opsStaffDocumentsApi,
  shiftEligibilityReasonLabel,
  staffDocumentListStatusLabel,
  STAFF_DOCUMENT_LIST_STATUS_LABELS,
} from "@/lib/ops-staff-documents";
import {
  categoryDraftFromCategory,
  STAFF_DOCUMENT_TYPES,
  type CarerDocumentCategory,
} from "@/lib/carer-documents";
import { opsStaffDocumentContentCacheKey } from "@/lib/staff-document-content";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function sampleCategory(
  overrides: Partial<CarerDocumentCategory> = {},
): CarerDocumentCategory {
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
    files: [
      {
        id: "file-1",
        originalFilename: "record.pdf",
        contentType: "application/pdf",
        byteSize: 1024,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("staff list document status labels", () => {
  it("maps backend aggregate statuses to exact Ops copy", () => {
    expect(staffDocumentListStatusLabel("no_documents_submitted")).toBe("No Documents Submitted");
    expect(staffDocumentListStatusLabel("pending_review")).toBe("Pending Review");
    expect(staffDocumentListStatusLabel("warning")).toBe("Warning");
    expect(staffDocumentListStatusLabel("approved")).toBe("Approved");
  });

  it("renders Document Status column from backend documentStatus field", () => {
    const src = readSrc("routes/_authenticated/staff.index.tsx");
    expect(src).toContain("DocumentStatusBadge");
    expect(src).toContain("documentStatus");
    expect(src).not.toMatch(/deriveStaffDocumentListStatus|complianceForRequiredCategories/);
  });
});

describe("ops staff documents API client", () => {
  it("defines focused ops endpoints without private backend fields", () => {
    expect(typeof opsStaffDocumentsApi.get).toBe("function");
    expect(typeof opsStaffDocumentsApi.approveSubmission).toBe("function");
    expect(typeof opsStaffDocumentsApi.flagIssue).toBe("function");
    expect(typeof opsStaffDocumentsApi.setReminders).toBe("function");
    expect(typeof opsStaffDocumentsApi.clearCategory).toBe("function");
    expect(String(opsStaffDocumentsApi.get)).not.toContain("storageKey");
  });

  it("uses exact submission paths for approve and flag issue", () => {
    const staffId = "11111111-1111-4111-8111-111111111111";
    const submissionId = "22222222-2222-4222-8222-222222222222";
    expect(String(opsStaffDocumentsApi.approveSubmission)).toContain("/submissions/");
    expect(
      opsStaffDocumentContentPath({
        staffId,
        documentType: "immunizations",
        fileId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toBe(
      `/staff/${staffId}/documents/immunizations/files/33333333-3333-4333-8333-333333333333/content`,
    );
    expect(
      opsStaffDocumentContentCacheKey({
        staffId,
        documentType: "immunizations",
        fileId: submissionId,
      }),
    ).toContain("ops:");
    expect(
      opsStaffDocumentContentPath({
        staffId,
        documentType: "immunizations",
        fileId: submissionId,
      }),
    ).not.toContain("storage");
  });
});

describe("shift eligibility copy", () => {
  it("maps backend reasons to readable Ops copy", () => {
    expect(shiftEligibilityReasonLabel("missing_required_submission")).toMatch(/Missing required/i);
    expect(shiftEligibilityReasonLabel("pending_review")).toMatch(/pending review/i);
    expect(shiftEligibilityReasonLabel("issue_flagged")).toMatch(/issue flagged/i);
    expect(shiftEligibilityReasonLabel("expired")).toMatch(/expired/i);
  });

  it("shows compliance summary on staff documents section", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("Eligible for shift matching");
    expect(src).toContain("Not eligible for shift matching");
    expect(src).toContain("shiftEligibilityReasonLabel");
  });
});

describe("stale submission handling", () => {
  it("detects 409 stale submission responses", () => {
    expect(isStaleSubmissionError(new ApiError(409, "Submission is no longer current."))).toBe(true);
    expect(isStaleSubmissionError(new ApiError(400, "bad"))).toBe(false);
  });

  it("maps stale submissions to refresh messaging", () => {
    expect(mapOpsDocumentsApiError(new ApiError(409, "stale"), "fallback")).toMatch(/replaced/i);
  });

  it("requires confirmation before approve in UI", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("Approve this document submission?");
    expect(src).toContain("currentSubmissionId");
  });
});

describe("ops upload and replace", () => {
  it("covers four document categories", () => {
    expect(STAFF_DOCUMENT_TYPES).toHaveLength(4);
  });

  it("retains existing files in save payload by default", () => {
    const draft = categoryDraftFromCategory(sampleCategory());
    const formData = buildOpsCategorySaveFormData("immunizations", draft);
    expect(formData.get("retainFileIds")).toBe(JSON.stringify(["file-1"]));
  });

  it("uses edit/replace flow with local draft before save", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("Replacing this submission will return it to Pending Review");
    expect(src).toContain("retainFileIds");
    expect(src).not.toMatch(/auto.?approv/i);
  });
});

describe("clear submission and reminders", () => {
  it("requires clear confirmation with history-retained copy", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("Historical submissions are retained");
    expect(src).toContain("Clear Submission");
  });

  it("shows reminder toggles only for VSC and First Aid", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain('type === "vulnerable_sector_check" || type === "first_aid_cpr"');
    expect(src).toContain("Automated expiry reminders");
    expect(src).toContain("setReminders");
  });

  it("PATCHes reminder preference payload", () => {
    expect(String(opsStaffDocumentsApi.setReminders)).toContain("/reminders");
  });
});

describe("flag issue workflow", () => {
  it("requires issue note in UI", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain('id="issue-note"');
    expect(src).toContain("maxLength={2000}");
    expect(src).toContain("Flag Issue");
  });
});

describe("document detail statuses", () => {
  it("displays issue flagged categories with issue notes from backend", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("issueNote");
    expect(src).toContain("expiryDisplay");
  });

  it("invalidates staff list and detail queries after mutations", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain('["staff-list"]');
    expect(src).toContain('["staff-documents", staffId]');
  });
});

describe("status label completeness", () => {
  it("defines all four list statuses", () => {
    expect(Object.keys(STAFF_DOCUMENT_LIST_STATUS_LABELS)).toHaveLength(4);
  });
});

describe("simplified ops documents section", () => {
  it("maps review status to state-based primary actions", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain('label: "Upload"');
    expect(src).toContain('label: "Review"');
    expect(src).toContain('label: "Review Issue"');
    expect(src).toContain('label: "View"');
    expect(src).toContain("reviewStatus === \"pending_review\"");
    expect(src).toContain("reviewStatus === \"issue_flagged\"");
    expect(src).not.toMatch(/deriveStaffDocumentListStatus|complianceForRequiredCategories/);
  });

  it("uses progressive disclosure panels for review and edit flows", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain('panelMode === "review"');
    expect(src).toContain('panelMode === "edit"');
    expect(src).toContain("closePanel");
    expect(src).toContain("aria-expanded={isOpen}");
    expect(src).toContain("aria-controls={isOpen ? panelId : undefined}");
  });

  it("keeps approve and flag on exact currentSubmissionId in review panel", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("submissionId: category.currentSubmissionId!");
    expect(src).toContain("approveSubmission");
    expect(src).toContain("flagIssue");
    expect(src).toContain("handleStaleRefresh");
    expect(src).not.toMatch(/auto.?retry|retry.*approve/i);
  });

  it("exposes secondary actions through overflow menu without removing replace/clear", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("DropdownMenu");
    expect(src).toContain("More actions for");
    expect(src).toContain("Details &amp; files");
    expect(src).toContain("Replace");
    expect(src).toContain("Clear Submission");
    expect(src).toContain("DropdownMenuSeparator");
  });

  it("uses authenticated ops file helpers for view and download", () => {
    const src = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(src).toContain("openOpsStaffDocumentFile");
    expect(src).toContain("downloadOpsStaffDocumentFile");
    expect(src).not.toContain("storageKey");
  });
});

describe("carer onboarding navigation preservation", () => {
  it("retains step 3 hub backward navigation", () => {
    expect(readSrc("components/carer/CarerOnboardingShell.tsx")).toContain("isOnboardingStepNavigable");
    expect(readSrc("routes/carer/onboarding/availability.tsx")).toContain("CarerOnboardingHomeLink");
    expect(readSrc("lib/carer-onboarding.ts")).toContain("isOnboardingStepNavigable");
  });
});
