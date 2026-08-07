export const MANUAL_STAFF_ROLES = ["ECA", "ECE", "Nanny"] as const;

export type ManualStaffRole = (typeof MANUAL_STAFF_ROLES)[number];

export type ManualStaffFormValues = {
  displayName: string;
  legalFirstName: string;
  legalLastName: string;
  role: ManualStaffRole | "";
  email: string;
  phone: string;
  address: string;
  city: string;
};

const ROLE_ERROR = "Role must be ECA, ECE, or Nanny.";

export function validateManualStaffForm(values: ManualStaffFormValues): Partial<
  Record<keyof ManualStaffFormValues, string>
> {
  const errors: Partial<Record<keyof ManualStaffFormValues, string>> = {};
  const req = (key: keyof ManualStaffFormValues, label: string) => {
    if (!String(values[key] ?? "").trim()) errors[key] = `${label} is required.`;
  };
  req("displayName", "Display name");
  req("legalFirstName", "Legal first name");
  req("legalLastName", "Legal last name");
  req("phone", "Phone number");
  req("address", "Home address");
  req("city", "City");
  const role = values.role.trim();
  if (!role) errors.role = "Role is required.";
  else if (!MANUAL_STAFF_ROLES.includes(role as ManualStaffRole)) errors.role = ROLE_ERROR;
  const email = values.email.trim();
  if (!email) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}
