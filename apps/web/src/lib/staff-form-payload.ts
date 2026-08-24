import { cityValueForSubmit } from "@/components/CityCombobox";
import type { StaffStatus } from "@/lib/db";

/** Staff GET response fields passed into the edit form (includes read-only props). */
export type StaffFormInitialSource = Partial<StaffFormEditableValues> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  portalAccount?: unknown;
  portalAccountStatus?: string;
  legalFirstName?: string;
  legalLastName?: string;
};

/** Fields allowed by the API UpsertStaffDto on PATCH /staff/:id. */
export const STAFF_UPDATE_FIELD_KEYS = [
  "legalName",
  "displayName",
  "useDisplayName",
  "phone",
  "email",
  "role",
  "status",
  "notes",
  "address",
  "city",
] as const;

export type StaffUpdatePayload = {
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
  phone: string;
  email: string;
  role: string;
  status: StaffStatus;
  notes: string;
  address: string;
  city: string;
};

export type StaffFormEditableValues = StaffUpdatePayload;

const READ_ONLY_STAFF_RESPONSE_KEYS = [
  "id",
  "createdAt",
  "updatedAt",
  "portalAccount",
  "portalAccountStatus",
  "legalFirstName",
  "legalLastName",
] as const;

/** Pick only editable form fields from a staff API response. */
export function pickStaffFormEditableInitial(source: StaffFormInitialSource): StaffFormEditableValues {
  return {
    legalName: String(source.legalName ?? ""),
    displayName: String(source.displayName ?? ""),
    useDisplayName: Boolean(source.useDisplayName),
    phone: String(source.phone ?? ""),
    email: String(source.email ?? ""),
    role: String(source.role ?? ""),
    status: (source.status as StaffStatus) ?? "active",
    notes: String(source.notes ?? ""),
    address: String(source.address ?? ""),
    city: String(source.city ?? ""),
  };
}

/** Build the PATCH body — never includes read-only server fields. */
export function buildStaffUpdatePayload(
  values: StaffFormEditableValues,
  savedCity: string,
): StaffUpdatePayload | null {
  const city = cityValueForSubmit(values.city.trim(), savedCity.trim());
  if (!city) return null;

  return {
    legalName: values.legalName.trim(),
    displayName: values.displayName.trim(),
    useDisplayName: values.useDisplayName,
    phone: values.phone.trim(),
    email: values.email.trim(),
    role: values.role.trim(),
    status: values.status,
    notes: values.notes.trim(),
    address: values.address.trim(),
    city,
  };
}

export function staffUpdatePayloadExcludesReadOnlyFields(payload: StaffUpdatePayload): boolean {
  const keys = Object.keys(payload);
  return READ_ONLY_STAFF_RESPONSE_KEYS.every((key) => !keys.includes(key));
}
