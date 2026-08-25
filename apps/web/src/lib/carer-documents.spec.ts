import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "@/lib/api";
import {
  buildCategorySaveFormData,
  CARER_DOCUMENT_CATEGORY_META,
  categoryDraftDirty,
  categoryDraftFromCategory,
  deriveVscRenewalDueDate,
  emptyCategoryDrafts,
  documentsDraftDirty,
  formatVscRenewalDueLabel,
  mapDocumentsApiError,
  reviewStatusLabel,
  STAFF_DOCUMENT_MAX_FILE_BYTES,
  STAFF_DOCUMENT_MAX_FILES,
  STAFF_COMPLIANCE_DOCUMENT_TYPES,
  QUALIFICATION_STAFF_DOCUMENT_TYPES,
  qualificationTypesForStaffRole,
  QUALIFICATIONS_SECTION_COPY,
  STAFF_DOCUMENT_TYPES,
  validateCategoryDraft,
  type CarerDocumentCategory,
  type CarerDocumentsList,
} from "@/lib/carer-documents";
import {
  staffDocumentContentCacheKey,
  staffDocumentContentPath,
} from "@/lib/staff-document-content";

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

function sampleDocuments(categories: CarerDocumentCategory[]): CarerDocumentsList {
  return {
    staffRole: "ECA",
    categories,
    documentsCompletedAt: null,
    onboardingStep: 2,
    canCompleteStep2: false,
    documentStatus: "pending_review",
    shiftEligible: false,
    shiftEligibilityReasons: [],
  };
}

describe("carer document category metadata", () => {
  it("defines compliance and qualification categories", () => {
    expect(STAFF_DOCUMENT_TYPES).toHaveLength(7);
    expect(STAFF_COMPLIANCE_DOCUMENT_TYPES).toHaveLength(4);
    expect(QUALIFICATION_STAFF_DOCUMENT_TYPES).toEqual([
      "eca_diploma",
      "ece_diploma",
      "rece_proof",
    ]);
    expect(CARER_DOCUMENT_CATEGORY_META.vulnerable_sector_check.required).toBe(true);
    expect(CARER_DOCUMENT_CATEGORY_META.vulnerable_sector_check.dateField).toBe("processed");
    expect(CARER_DOCUMENT_CATEGORY_META.covid19_vaccination.required).toBe(false);
    expect(CARER_DOCUMENT_CATEGORY_META.eca_diploma.required).toBe(false);
    expect(CARER_DOCUMENT_CATEGORY_META.rece_proof.helperText).toMatch(/RECE registration/i);
  });

  it("shows role-based qualification types", () => {
    expect(qualificationTypesForStaffRole("ECA")).toEqual(["eca_diploma"]);
    expect(qualificationTypesForStaffRole("ECE")).toEqual(["ece_diploma", "rece_proof"]);
    expect(qualificationTypesForStaffRole("Nanny")).toEqual([]);
  });
});

describe("category draft state", () => {
  it("retains existing file ids by default", () => {
    const draft = categoryDraftFromCategory(sampleCategory());
    expect(draft.retainFileIds).toEqual(["file-1"]);
    expect(draft.newFiles).toEqual([]);
  });

  it("detects dirty state when a new file is selected", () => {
    const saved = categoryDraftFromCategory(sampleCategory());
    const dirty = {
      ...saved,
      newFiles: [new File(["x"], "new.pdf", { type: "application/pdf" })],
    };
    expect(categoryDraftDirty(dirty, saved, "immunizations")).toBe(true);
    expect(documentsDraftDirty(
      { ...emptyCategoryDrafts(), immunizations: dirty },
      { ...emptyCategoryDrafts(), immunizations: saved },
    )).toBe(true);
  });

  it("detects retained file removal locally without API calls", () => {
    const saved = categoryDraftFromCategory(sampleCategory());
    const dirty = { ...saved, retainFileIds: [] };
    expect(categoryDraftDirty(dirty, saved, "immunizations")).toBe(true);
  });

  it("does not treat unchanged VSC expiry as dirty when only processed date matches", () => {
    const saved = categoryDraftFromCategory(
      sampleCategory({
        documentType: "vulnerable_sector_check",
        processedDate: "2026-08-19",
        expiryDate: "2027-08-19",
      }),
    );
    const dirty = { ...saved, expiryDate: "2099-01-01" };
    expect(categoryDraftDirty(dirty, saved, "vulnerable_sector_check")).toBe(false);
  });
});

describe("validateCategoryDraft", () => {
  it("rejects unsupported extensions", () => {
    const draft = {
      retainFileIds: [],
      newFiles: [new File(["x"], "notes.docx", { type: "application/msword" })],
      processedDate: "",
      expiryDate: "",
    };
    expect(validateCategoryDraft("immunizations", draft, [])).toMatch(/PDF, PNG, JPG, or JPEG/i);
  });

  it("rejects files larger than 50 MB", () => {
    const big = new File([new Uint8Array(STAFF_DOCUMENT_MAX_FILE_BYTES + 1)], "big.pdf", {
      type: "application/pdf",
    });
    const draft = {
      retainFileIds: [],
      newFiles: [big],
      processedDate: "",
      expiryDate: "",
    };
    expect(validateCategoryDraft("immunizations", draft, [])).toMatch(/50 MB/i);
  });

  it("rejects more than 10 total files", () => {
    const files = Array.from({ length: STAFF_DOCUMENT_MAX_FILES + 1 }, (_, i) =>
      new File(["x"], `file-${i}.pdf`, { type: "application/pdf" }),
    );
    const draft = {
      retainFileIds: [],
      newFiles: files,
      processedDate: "",
      expiryDate: "",
    };
    expect(validateCategoryDraft("immunizations", draft, [])).toMatch(/10 files/i);
  });

  it("requires VSC processed date only", () => {
    expect(
      validateCategoryDraft(
        "vulnerable_sector_check",
        { retainFileIds: [], newFiles: [new File(["x"], "vsc.pdf")], processedDate: "", expiryDate: "" },
        [],
      ),
    ).toMatch(/Processed date/i);

    expect(
      validateCategoryDraft(
        "vulnerable_sector_check",
        {
          retainFileIds: [],
          newFiles: [new File(["x"], "vsc.pdf")],
          processedDate: "2026-08-19",
          expiryDate: "",
        },
        [],
      ),
    ).toBeNull();
  });

  it("derives display-only VSC renewal due from processed date", () => {
    expect(deriveVscRenewalDueDate("2026-08-19")).toBe("2027-08-19");
    expect(deriveVscRenewalDueDate("2028-02-29")).toBe("2029-02-28");
    expect(formatVscRenewalDueLabel("2027-08-19")).toMatch(/Renewal due:/);
  });

  it("requires First Aid expiry date", () => {
    expect(
      validateCategoryDraft(
        "first_aid_cpr",
        { retainFileIds: [], newFiles: [new File(["x"], "fa.pdf")], processedDate: "", expiryDate: "" },
        [],
      ),
    ).toMatch(/Expiry date/i);
  });
});

describe("buildCategorySaveFormData", () => {
  it("includes retainFileIds and files in multipart payload", () => {
    const file = new File(["%PDF"], "scan.pdf", { type: "application/pdf" });
    const formData = buildCategorySaveFormData("immunizations", {
      retainFileIds: ["file-1"],
      newFiles: [file],
      processedDate: "",
      expiryDate: "",
    });
    expect(formData.get("retainFileIds")).toBe(JSON.stringify(["file-1"]));
    expect(formData.getAll("files")).toHaveLength(1);
  });

  it("sends processedDate only for VSC", () => {
    const vsc = buildCategorySaveFormData("vulnerable_sector_check", {
      retainFileIds: [],
      newFiles: [new File(["x"], "vsc.pdf")],
      processedDate: "2026-08-19",
      expiryDate: "2099-01-01",
    });
    expect(vsc.get("processedDate")).toBe("2026-08-19");
    expect(vsc.get("expiryDate")).toBeNull();

    const fa = buildCategorySaveFormData("first_aid_cpr", {
      retainFileIds: [],
      newFiles: [new File(["x"], "fa.pdf")],
      processedDate: "",
      expiryDate: "2028-06-01",
    });
    expect(fa.get("expiryDate")).toBe("2028-06-01");
  });
});

describe("review status labels", () => {
  it("maps backend review statuses for display", () => {
    expect(reviewStatusLabel("issue_flagged")).toBe("Issue Flagged");
    expect(reviewStatusLabel("approved")).toBe("Approved");
  });
});

describe("mapDocumentsApiError", () => {
  it("maps common API failures to user-facing messages", () => {
    expect(mapDocumentsApiError(new ApiError(413, "too big"), "fallback")).toMatch(/50 MB/i);
    expect(mapDocumentsApiError(new ApiError(401, "unauthorized"), "fallback")).toMatch(/session expired/i);
    expect(mapDocumentsApiError(new ApiError(404, "missing"), "fallback")).toMatch(/not available/i);
    expect(mapDocumentsApiError(new ApiError(503, "down"), "fallback")).toMatch(/temporarily unavailable/i);
  });
});

describe("staff document content helpers", () => {
  it("builds authenticated staff-portal content paths without storage keys", () => {
    const input = {
      documentType: "immunizations" as const,
      fileId: "22222222-2222-4222-8222-222222222222",
    };
    expect(staffDocumentContentCacheKey(input)).toBe("immunizations:22222222-2222-4222-8222-222222222222");
    expect(staffDocumentContentPath(input)).toBe(
      "/staff-portal/documents/immunizations/files/22222222-2222-4222-8222-222222222222/content",
    );
    expect(staffDocumentContentPath(input)).not.toContain("storage");
  });
});

describe("documents list shape", () => {
  it("supports issue flagged categories with issue notes from backend", () => {
    const docs = sampleDocuments([
      sampleCategory({
        reviewStatus: "issue_flagged",
        issueNote: "Please upload a clearer copy.",
      }),
    ]);
    expect(docs.categories[0]?.issueNote).toBe("Please upload a clearer copy.");
  });
});

describe("carer documents UI", () => {
  it("does not expose reminder preference controls", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).not.toContain("Expiry email reminders");
    expect(src).not.toContain("setReminders");
    expect(src).not.toContain("Calculated by Intra");
  });

  it("shows editable VSC processed date without editable expiry", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).toContain('dateField === "processed"');
    expect(src).toContain("Processed Date");
    expect(src).toContain("formatVscRenewalDueLabel");
    expect(src).not.toContain('dateField === "both"');
    expect(src).not.toMatch(/ops-expiry-vsc|expiry-\$\{category\.documentType\}.*Vulnerable/);
  });

  it("renders optional qualifications section with role-based visibility", () => {
    const src = readSrc("components/carer/CarerDocumentsForm.tsx");
    expect(src).toContain("Qualifications (Optional)");
    expect(src).toContain("QUALIFICATIONS_SECTION_COPY");
    expect(src).toContain("qualificationTypesForStaffRole");
    expect(src).toContain("STAFF_COMPLIANCE_DOCUMENT_TYPES");
  });
});
