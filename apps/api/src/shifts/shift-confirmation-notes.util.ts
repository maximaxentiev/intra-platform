/** External Shift Notes — safe for Centre/Carer confirmations in later phases. */
export function normalizeShiftConfirmationNotes(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
