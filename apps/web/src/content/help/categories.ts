import type { HelpCategory } from "./types";

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "getting-started", label: "Getting Started" },
  { id: "centres-and-staff", label: "Centres & Staff" },
  { id: "individual-shifts", label: "Individual Shifts" },
  { id: "batch-requests", label: "Batch Requests" },
  { id: "reference", label: "Reference" },
];

export function helpCategoryLabel(categoryId: HelpCategory["id"]): string {
  return HELP_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}
