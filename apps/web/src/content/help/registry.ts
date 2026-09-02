import type { ReactNode } from "react";
import type { HelpArticle, HelpArticleMeta, HelpCategoryId } from "./types";
import { PlatformOverviewBody } from "./content/platform-overview-body";
import { ManageCentresBody } from "./content/manage-centres-body";
import { ManageStaffProfilesAndAvailabilityBody } from "./content/manage-staff-profiles-and-availability-body";
import { ReviewAndApproveStaffDocumentsBody } from "./content/review-and-approve-staff-documents-body";
import { CreateAnIndividualShiftBody } from "./content/create-an-individual-shift-body";
import { UnderstandAvailableStaffAndPriorityBody } from "./content/understand-available-staff-and-priority-body";
import { AssignReplaceOrUnassignACarerBody } from "./content/assign-replace-or-unassign-a-carer-body";
import { EditOrCancelAShiftBody } from "./content/edit-or-cancel-a-shift-body";
import { CreateABatchRequestBody } from "./content/create-a-batch-request-body";
import { FillCompleteAndUpdateABatchRequestBody } from "./content/fill-complete-and-update-a-batch-request-body";
import { HelpPlaceholderBody } from "./content/placeholder-body";

const ARTICLE_DEFINITIONS: HelpArticleMeta[] = [
  {
    slug: "platform-overview",
    title: "Platform Overview",
    summary:
      "Get familiar with the main areas of the Intra platform and where to go for common Operations tasks.",
    category: "getting-started",
    keywords: [
      "dashboard",
      "navigation",
      "platform",
      "overview",
      "getting started",
      "centres",
      "staff",
      "carers",
      "shifts",
      "batches",
      "reports",
      "applications",
      "users",
      "help",
    ],
    relatedSlugs: [
      "manage-centres",
      "manage-staff-profiles-and-availability",
      "create-an-individual-shift",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "manage-centres",
    title: "Manage Centres",
    summary:
      "Learn how to find, create and update Centres, manage contacts, and maintain Top and Banned Carer preferences.",
    category: "centres-and-staff",
    keywords: [
      "centre",
      "create centre",
      "edit centre",
      "centre contact",
      "primary contact",
      "top carer",
      "top staff",
      "banned carer",
      "ban carer",
      "banned staff",
      "staff preferences",
      "staffpoint",
      "centre rules",
      "rules notes",
    ],
    relatedSlugs: [
      "manage-staff-profiles-and-availability",
      "understand-available-staff-and-priority",
      "create-an-individual-shift",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "manage-staff-profiles-and-availability",
    title: "Manage Staff Profiles & Availability",
    summary:
      "Learn how to find and update Carer profiles, manage portal access, review availability, and understand Centre preferences and Shift history.",
    category: "centres-and-staff",
    keywords: [
      "staff",
      "carer",
      "profile",
      "availability",
      "portal",
      "invite",
      "resend invite",
      "disable portal",
      "role",
      "centre preferences",
      "top",
      "banned",
      "shift history",
      "team availability",
    ],
    relatedSlugs: [
      "manage-centres",
      "review-and-approve-staff-documents",
      "understand-available-staff-and-priority",
      "create-an-individual-shift",
    ],
  },
  {
    slug: "review-and-approve-staff-documents",
    title: "Review & Approve Staff Documents",
    summary:
      "Learn how to review submitted staff documents, approve valid documents, flag issues, and understand how document status affects Shift eligibility.",
    category: "centres-and-staff",
    keywords: [
      "documents",
      "document review",
      "approve document",
      "pending review",
      "issue flagged",
      "VSC",
      "vulnerable sector",
      "first aid",
      "CPR",
      "immunizations",
      "COVID",
      "ECA diploma",
      "ECE diploma",
      "RECE proof",
      "expired",
      "expiring soon",
      "document share",
    ],
    relatedSlugs: [
      "manage-staff-profiles-and-availability",
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "create-an-individual-shift",
    title: "Create an Individual Shift",
    summary:
      "Learn how to create a new individual Shift with the correct Centre, date, time, role, Staffpoint setting and Shift Notes.",
    category: "individual-shifts",
    keywords: [
      "create shift",
      "new shift",
      "individual shift",
      "centre",
      "date",
      "start time",
      "end time",
      "role",
      "ECA",
      "ECE",
      "RECE",
      "Staffpoint",
      "Shift Notes",
    ],
    relatedSlugs: [
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "create-a-batch-request",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "understand-available-staff-and-priority",
    title: "Understand Available Staff & Priority",
    summary:
      "Learn how the Available Staff list works, what makes a Carer eligible for a Shift, and how Top, location, qualifications and Contacted affect what you see.",
    category: "individual-shifts",
    keywords: [
      "available staff",
      "priority",
      "matching",
      "eligible",
      "not eligible",
      "top staff",
      "banned staff",
      "contacted",
      "availability",
      "overlap",
      "buffer",
      "role",
      "RECE proof",
      "documents",
      "same city",
      "geography",
    ],
    relatedSlugs: [
      "assign-replace-or-unassign-a-carer",
      "review-and-approve-staff-documents",
      "manage-staff-profiles-and-availability",
      "manage-centres",
    ],
  },
  {
    slug: "assign-replace-or-unassign-a-carer",
    title: "Assign, Replace or Unassign a Carer",
    summary:
      "Learn how to contact and assign a Carer, replace an existing assignment, or unassign a Carer while managing the appropriate communications.",
    category: "individual-shifts",
    keywords: [
      "assign",
      "assignment",
      "assign carer",
      "contacted",
      "replace carer",
      "replacement",
      "reassign",
      "switch carer",
      "previous carer",
      "unassign",
      "remove carer",
      "resend confirmation",
      "filled",
      "pending",
    ],
    relatedSlugs: [
      "understand-available-staff-and-priority",
      "edit-or-cancel-a-shift",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "edit-or-cancel-a-shift",
    title: "Edit or Cancel a Shift",
    summary:
      "Learn how to update an existing Shift, handle changes that affect the assigned Carer, and cancel a Shift with the appropriate communications.",
    category: "individual-shifts",
    keywords: [
      "edit shift",
      "change shift",
      "change schedule",
      "change time",
      "change date",
      "change role",
      "shift notes",
      "unavailable carer",
      "availability confirmed",
      "unassign after edit",
      "cancel shift",
      "cancellation",
      "cancellation reason",
      "delete shift",
      "updates required",
    ],
    relatedSlugs: [
      "assign-replace-or-unassign-a-carer",
      "understand-available-staff-and-priority",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "create-a-batch-request",
    title: "Create a Batch Request",
    summary:
      "Learn how to create a Batch Request for multiple Shifts from the same Centre, including Shift details, notes, duplication and draft management.",
    category: "batch-requests",
    keywords: [
      "create batch",
      "batch request",
      "multiple shifts",
      "add shift",
      "duplicate shift",
      "remove shift",
      "batch notes",
      "shift notes",
      "internal comment",
      "staffpoint",
      "ECA",
      "ECE",
      "RECE",
    ],
    relatedSlugs: [
      "create-an-individual-shift",
      "fill-complete-and-update-a-batch-request",
      "understand-available-staff-and-priority",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "fill-complete-and-update-a-batch-request",
    title: "Fill, Complete & Update a Batch Request",
    summary:
      "Learn how to fill a Batch Request, complete it for the Centre, and send a consolidated update when assignments or Shift details change later.",
    category: "batch-requests",
    keywords: [
      "fill batch",
      "batch progress",
      "complete request",
      "complete batch",
      "batch confirmation",
      "centre confirmation",
      "70 percent",
      "updates required",
      "ready to send updates",
      "send updates",
      "update confirmation",
      "what changed",
      "batch email",
      "retry batch email",
    ],
    relatedSlugs: [
      "create-a-batch-request",
      "assign-replace-or-unassign-a-carer",
      "edit-or-cancel-a-shift",
      "cancel-a-batch-request",
    ],
  },
  {
    slug: "cancel-a-batch-request",
    title: "Cancel a Batch Request",
    summary: "Cancel an entire batch request and understand communication options.",
    category: "batch-requests",
    keywords: ["cancel batch", "batch cancellation"],
    relatedSlugs: ["communications-notes-and-important-terminology"],
  },
  {
    slug: "communications-notes-and-important-terminology",
    title: "Communications, Notes & Important Terminology",
    summary: "Reference for emails, Shift Notes, internal comments, and common terms.",
    category: "reference",
    keywords: [
      "email",
      "communication",
      "shift notes",
      "internal comments",
      "activity",
      "terminology",
      "status",
    ],
    relatedSlugs: ["assign-replace-or-unassign-a-carer"],
  },
];

const CONTENT_BY_SLUG: Record<string, () => React.ReactNode> = {
  "platform-overview": PlatformOverviewBody,
  "manage-centres": ManageCentresBody,
  "manage-staff-profiles-and-availability": ManageStaffProfilesAndAvailabilityBody,
  "review-and-approve-staff-documents": ReviewAndApproveStaffDocumentsBody,
  "create-an-individual-shift": CreateAnIndividualShiftBody,
  "understand-available-staff-and-priority": UnderstandAvailableStaffAndPriorityBody,
  "assign-replace-or-unassign-a-carer": AssignReplaceOrUnassignACarerBody,
  "edit-or-cancel-a-shift": EditOrCancelAShiftBody,
  "create-a-batch-request": CreateABatchRequestBody,
  "fill-complete-and-update-a-batch-request": FillCompleteAndUpdateABatchRequestBody,
};

function resolveContent(slug: string) {
  const Content = CONTENT_BY_SLUG[slug] ?? HelpPlaceholderBody;
  return Content;
}

export const HELP_ARTICLES: HelpArticle[] = ARTICLE_DEFINITIONS.map((meta) => ({
  ...meta,
  Content: resolveContent(meta.slug),
}));

export const HELP_ARTICLE_BY_SLUG = new Map(HELP_ARTICLES.map((article) => [article.slug, article]));

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLE_BY_SLUG.get(slug);
}

export function getHelpArticlesByCategory(category: HelpCategoryId): HelpArticleMeta[] {
  return HELP_ARTICLES.filter((article) => article.category === category);
}

export function searchHelpArticles(query: string): HelpArticleMeta[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return HELP_ARTICLES.filter((article) => {
    if (article.title.toLowerCase().includes(normalized)) return true;
    if (article.summary.toLowerCase().includes(normalized)) return true;
    return article.keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
  });
}

export function getRelatedHelpArticles(slug: string): HelpArticleMeta[] {
  const article = getHelpArticle(slug);
  if (!article) return [];

  return article.relatedSlugs
    .map((relatedSlug) => getHelpArticle(relatedSlug))
    .filter((related): related is HelpArticle => related != null)
    .slice(0, 4);
}
