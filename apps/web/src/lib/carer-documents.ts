import { api, ApiError } from "@/lib/api";

export const STAFF_DOCUMENT_TYPES = [
  "vulnerable_sector_check",
  "first_aid_cpr",
  "immunizations",
  "covid19_vaccination",
] as const;

export type StaffDocumentType = (typeof STAFF_DOCUMENT_TYPES)[number];

export type CarerDocumentFile = {
  id: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
};

export type CarerDocumentCategory = {
  documentType: StaffDocumentType;
  required: boolean;
  isSubmitted: boolean;
  reviewStatus: string;
  processedDate: string | null;
  expiryDate: string | null;
  expiryDisplay: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  issueNote: string | null;
  remindersEnabled: boolean;
  currentSubmissionId: string | null;
  files: CarerDocumentFile[];
};

export type CarerDocumentsList = {
  categories: CarerDocumentCategory[];
  documentsCompletedAt: string | null;
  onboardingStep: number;
  canCompleteStep2: boolean;
  documentStatus: string;
  shiftEligible: boolean;
  shiftEligibilityReasons: string[];
};

export const CARER_DOCUMENT_CATEGORY_META: Record<
  StaffDocumentType,
  { title: string; required: boolean; dateField: "processed" | "expiry" | null }
> = {
  vulnerable_sector_check: {
    title: "Vulnerable Sector Check",
    required: true,
    dateField: "processed",
  },
  first_aid_cpr: {
    title: "First Aid & CPR Certification",
    required: true,
    dateField: "expiry",
  },
  immunizations: {
    title: "Immunizations",
    required: true,
    dateField: null,
  },
  covid19_vaccination: {
    title: "COVID-19 Vaccination",
    required: false,
    dateField: null,
  },
};

export const STAFF_DOCUMENT_MAX_FILES = 10;
export const STAFF_DOCUMENT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const STAFF_DOCUMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

export type CategoryDraft = {
  retainFileIds: string[];
  newFiles: File[];
  processedDate: string;
  expiryDate: string;
};

export function categoryDraftFromCategory(category: CarerDocumentCategory): CategoryDraft {
  return {
    retainFileIds: category.files.map((f) => f.id),
    newFiles: [],
    processedDate: category.processedDate ?? "",
    expiryDate: category.expiryDate ?? "",
  };
}

export function categoryDraftDirty(a: CategoryDraft, b: CategoryDraft): boolean {
  if (a.processedDate !== b.processedDate) return true;
  if (a.expiryDate !== b.expiryDate) return true;
  if (a.newFiles.length > 0) return true;
  if (a.retainFileIds.length !== b.retainFileIds.length) return true;
  const sortedA = [...a.retainFileIds].sort();
  const sortedB = [...b.retainFileIds].sort();
  return sortedA.some((id, i) => id !== sortedB[i]);
}

export function documentsDraftDirty(
  drafts: Record<StaffDocumentType, CategoryDraft>,
  saved: Record<StaffDocumentType, CategoryDraft>,
): boolean {
  return STAFF_DOCUMENT_TYPES.some((type) => categoryDraftDirty(drafts[type], saved[type]));
}

function extensionOf(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot).toLowerCase();
}

export function formatDocumentByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDocumentDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function reviewStatusLabel(status: string): string {
  switch (status) {
    case "not_submitted":
      return "Not submitted";
    case "pending_review":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "issue_flagged":
      return "Issue Flagged";
    default:
      return status.replace(/_/g, " ");
  }
}

export function expiryDisplayLabel(display: string): string | null {
  switch (display) {
    case "expiring_soon":
      return "Expiring Soon";
    case "expired":
      return "Expired";
    case "current":
      return "Current";
    default:
      return null;
  }
}

export function validateCategoryDraft(
  documentType: StaffDocumentType,
  draft: CategoryDraft,
  existingFiles: CarerDocumentFile[],
): string | null {
  const meta = CARER_DOCUMENT_CATEGORY_META[documentType];
  const retained = existingFiles.filter((f) => draft.retainFileIds.includes(f.id));
  const totalFiles = retained.length + draft.newFiles.length;

  if (totalFiles === 0) {
    return "Add at least one file before saving.";
  }
  if (totalFiles > STAFF_DOCUMENT_MAX_FILES) {
    return `Up to ${STAFF_DOCUMENT_MAX_FILES} files are allowed per document type.`;
  }

  let totalBytes = retained.reduce((sum, f) => sum + f.byteSize, 0);
  for (const file of draft.newFiles) {
    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return "Upload PDF, PNG, JPG, or JPEG files.";
    }
    if (file.size > STAFF_DOCUMENT_MAX_FILE_BYTES) {
      return "File too large. Each file must be 50 MB or less.";
    }
    totalBytes += file.size;
  }
  if (totalBytes > STAFF_DOCUMENT_MAX_TOTAL_BYTES) {
    return "Up to 50 MB total is allowed per document type.";
  }

  if (meta.dateField === "processed" && !draft.processedDate.trim()) {
    return "Processed date is required.";
  }
  if (meta.dateField === "expiry" && !draft.expiryDate.trim()) {
    return "Expiry date is required.";
  }

  return null;
}

export function buildCategorySaveFormData(
  documentType: StaffDocumentType,
  draft: CategoryDraft,
): FormData {
  const formData = new FormData();
  formData.append("retainFileIds", JSON.stringify(draft.retainFileIds));
  for (const file of draft.newFiles) {
    formData.append("files", file, file.name);
  }
  if (documentType === "vulnerable_sector_check" && draft.processedDate) {
    formData.append("processedDate", draft.processedDate);
  }
  if (documentType === "first_aid_cpr" && draft.expiryDate) {
    formData.append("expiryDate", draft.expiryDate);
  }
  return formData;
}

export function mapDocumentsApiError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : fallback;
  }
  if (err.status === 401) return "Your session expired. Sign in again to continue.";
  if (err.status === 404) return "Document uploads are not available right now.";
  if (err.status === 413) return "Up to 50 MB total is allowed per document type.";
  if (err.status === 503) return "Document storage is temporarily unavailable. Try again later.";
  const msg = err.message;
  if (/mime|extension|signature|format/i.test(msg)) {
    return "Upload PDF, PNG, JPG, or JPEG files.";
  }
  return msg || fallback;
}

export const carerDocumentsApi = {
  get: () => api.get<CarerDocumentsList>("/staff-portal/documents"),
  saveCategory: (documentType: StaffDocumentType, formData: FormData) =>
    api.postForm<CarerDocumentsList>(`/staff-portal/documents/${documentType}`, formData),
  clearCategory: (documentType: StaffDocumentType) =>
    api.del<CarerDocumentsList>(`/staff-portal/documents/${documentType}`),
  completeStep2: () => api.post<CarerDocumentsList>("/staff-portal/documents/complete-step-2"),
};
