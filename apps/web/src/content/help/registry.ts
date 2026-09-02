import type { ReactNode } from "react";
import type { HelpArticle, HelpArticleMeta, HelpCategoryId } from "./types";
import { PlatformOverviewBody } from "./content/platform-overview-body";
import { ManageCentresBody } from "./content/manage-centres-body";
import { ManageStaffProfilesAndAvailabilityBody } from "./content/manage-staff-profiles-and-availability-body";
import { ReviewAndApproveStaffDocumentsBody } from "./content/review-and-approve-staff-documents-body";
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
    summary: "Create a single pending shift with schedule, role, and optional notes.",
    category: "individual-shifts",
    keywords: ["create shift", "new shift", "date", "time", "role"],
    relatedSlugs: [
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
    ],
  },
  {
    slug: "understand-available-staff-and-priority",
    title: "Understand Available Staff & Priority",
    summary: "Interpret matching results, priority, exclusions, and eligibility.",
    category: "individual-shifts",
    keywords: ["available staff", "priority", "matching", "top", "banned", "eligible", "availability"],
    relatedSlugs: ["assign-replace-or-unassign-a-carer"],
  },
  {
    slug: "assign-replace-or-unassign-a-carer",
    title: "Assign, Replace or Unassign a Carer",
    summary: "Mark Contacted, assign staff, replace an assignee, or unassign a shift.",
    category: "individual-shifts",
    keywords: ["assign", "contacted", "replace", "reassign", "unassign", "switch carer"],
    relatedSlugs: [
      "edit-or-cancel-a-shift",
      "communications-notes-and-important-terminology",
    ],
  },
  {
    slug: "edit-or-cancel-a-shift",
    title: "Edit or Cancel a Shift",
    summary: "Change shift details or cancel a shift with optional communications.",
    category: "individual-shifts",
    keywords: ["edit shift", "change shift", "cancel shift", "schedule", "date", "time"],
    relatedSlugs: ["assign-replace-or-unassign-a-carer"],
  },
  {
    slug: "create-a-batch-request",
    title: "Create a Batch Request",
    summary: "Create a batch with multiple draft shifts for one centre.",
    category: "batch-requests",
    keywords: ["batch", "create batch", "multiple shifts"],
    relatedSlugs: ["fill-complete-and-update-a-batch-request"],
  },
  {
    slug: "fill-complete-and-update-a-batch-request",
    title: "Fill, Complete & Update a Batch Request",
    summary: "Assign child shifts, complete the request, and send update confirmations.",
    category: "batch-requests",
    keywords: [
      "fill batch",
      "complete request",
      "update batch",
      "updates required",
      "send updates",
    ],
    relatedSlugs: [
      "cancel-a-batch-request",
      "communications-notes-and-important-terminology",
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
