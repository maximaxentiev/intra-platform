import type { ApplicationDocument, ApplicationRow } from "@/lib/applications";
import { label as toLabel } from "@/lib/applications";

export function nannyView(row: ApplicationRow) {
  return row.nanny ?? null;
}

export function displayNannyText(value: string | null | undefined): string {
  if (value === null || value === undefined || !String(value).trim()) return "—";
  return toLabel(String(value));
}

export function displayNannyBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value ? "Yes" : "No";
}

export function displayNannyList(values: string[] | null | undefined): string {
  if (!values?.length) return "—";
  return values.map((v) => toLabel(v)).join(", ");
}

export function displaySpokenEnglish(row: ApplicationRow): string {
  const rating = nannyView(row)?.languages.spokenEnglishRating;
  if (rating === null || rating === undefined) return "—";
  return `${rating} / 10`;
}

export function vscDocuments(documents: ApplicationDocument[]): ApplicationDocument[] {
  return documents.filter((d) => d.category === "vulnerable_sector_check");
}
