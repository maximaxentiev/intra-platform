import {
  ACTIVE_SHIFT_ROLES,
  formatShiftRoleLabel,
  normalizeShiftRole,
  type ActiveShiftRole,
} from "@intra/shared";

export { formatShiftRoleLabel, normalizeShiftRole };

/** Options for new Shift creation — ECA, ECE, RECE only. */
export const NEW_SHIFT_ROLE_OPTIONS: { value: ActiveShiftRole; label: string }[] =
  ACTIVE_SHIFT_ROLES.map((role) => ({ value: role, label: role }));

/**
 * Edit options preserve a legacy Nanny value without offering it for new selections.
 */
export function shiftRoleEditOptions(currentRole: string | null | undefined): {
  value: string;
  label: string;
}[] {
  const normalized = normalizeShiftRole(currentRole);
  const options = NEW_SHIFT_ROLE_OPTIONS.map(({ value, label }) => ({ value, label }));

  if (normalized === "Nanny" && !options.some((option) => option.value === "Nanny")) {
    return [{ value: "Nanny", label: "Nanny (legacy)" }, ...options];
  }

  return options;
}
