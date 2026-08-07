/** Canonical full legal name stored on staff.legal_name. */
export function composeLegalName(legalFirstName: string, legalLastName: string): string {
  return `${legalFirstName.trim()} ${legalLastName.trim()}`.trim();
}
