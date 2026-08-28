import type { CarerSession } from "./carer";
import {
  CARER_DOCUMENT_CATEGORY_META,
  STAFF_COMPLIANCE_DOCUMENT_TYPES,
  type CarerDocumentCategory,
  type CarerDocumentsList,
  type StaffDocumentType,
} from "./carer-documents";
import { carerOnboardingResumePath, onboardingComplete, type CarerOnboardingPath } from "./carer-onboarding";

export type CarerNeedsActionItem = {
  id: string;
  label: string;
  href: CarerOnboardingPath | "/carer/documents";
};

function documentNeedsAction(category: CarerDocumentCategory): string | null {
  if (!category.required) return null;

  const title = CARER_DOCUMENT_CATEGORY_META[category.documentType].title;

  if (!category.isSubmitted) {
    return `Upload ${title}`;
  }
  if (category.reviewStatus === "issue_flagged") {
    return `Update ${title}`;
  }
  if (category.expiryDisplay === "expired") {
    return `Renew ${title}`;
  }
  return null;
}

function complianceDocumentTypes(documents: CarerDocumentsList): StaffDocumentType[] {
  return STAFF_COMPLIANCE_DOCUMENT_TYPES.filter((type) =>
    documents.categories.some((category) => category.documentType === type),
  );
}

/** Builds home-screen action items from existing session and document state only. */
export function buildCarerNeedsActionItems(
  session: Pick<CarerSession, "onboardingComplete" | "onboardingCompletedAt">,
  documents: CarerDocumentsList | undefined,
): CarerNeedsActionItem[] {
  if (!onboardingComplete(session)) {
    return [
      {
        id: "onboarding-incomplete",
        label: "Finish setting up your account",
        href: carerOnboardingResumePath(session),
      },
    ];
  }

  if (!documents) return [];

  const items: CarerNeedsActionItem[] = [];
  for (const type of complianceDocumentTypes(documents)) {
    const category = documents.categories.find((entry) => entry.documentType === type);
    if (!category) continue;
    const label = documentNeedsAction(category);
    if (!label) continue;
    items.push({
      id: `${category.documentType}-${label}`,
      label,
      href: "/carer/documents",
    });
  }

  return items;
}
