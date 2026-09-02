import type { ReactNode } from "react";
import type { HelpArticle, HelpArticleMeta, HelpCategoryId } from "./types";
import { PlatformOverviewBody } from "./content/platform-overview-body";
import { HelpPlaceholderBody } from "./content/placeholder-body";

const ARTICLE_DEFINITIONS: HelpArticleMeta[] = [
  {
    slug: "platform-overview",
    title: "Platform Overview",
    summary: "Navigate the Ops Platform and understand the main areas of daily work.",
    category: "getting-started",
    keywords: ["dashboard", "navigation", "pages", "getting started", "overview"],
    relatedSlugs: ["manage-centres", "manage-staff-profiles-and-availability"],
  },
  {
    slug: "manage-centres",
    title: "Manage Centres",
    summary: "Create and maintain centres, contacts, Top Carers, and banned Carers.",
    category: "centres-and-staff",
    keywords: ["centre", "contact", "primary contact", "top", "banned", "staffpoint"],
    relatedSlugs: ["platform-overview"],
  },
  {
    slug: "manage-staff-profiles-and-availability",
    title: "Manage Staff Profiles & Availability",
    summary: "Maintain carer profiles, portal access, and weekly availability.",
    category: "centres-and-staff",
    keywords: ["staff", "carer", "profile", "availability", "portal", "invite"],
    relatedSlugs: ["platform-overview", "review-and-approve-staff-documents"],
  },
  {
    slug: "review-and-approve-staff-documents",
    title: "Review & Approve Staff Documents",
    summary: "Review document submissions and understand eligibility implications.",
    category: "centres-and-staff",
    keywords: [
      "documents",
      "approve",
      "VSC",
      "first aid",
      "immunizations",
      "RECE",
      "ECA",
      "ECE",
      "expired",
    ],
    relatedSlugs: ["manage-staff-profiles-and-availability", "understand-available-staff-and-priority"],
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
