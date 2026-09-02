import type { ReactNode } from "react";

export const HELP_CATEGORY_IDS = [
  "getting-started",
  "centres-and-staff",
  "individual-shifts",
  "batch-requests",
  "reference",
] as const;

export type HelpCategoryId = (typeof HELP_CATEGORY_IDS)[number];

export type HelpArticleMeta = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategoryId;
  keywords: string[];
  relatedSlugs: string[];
  videoUrl?: string;
};

export type HelpCategory = {
  id: HelpCategoryId;
  label: string;
};

export type HelpArticle = HelpArticleMeta & {
  Content: () => ReactNode;
};
