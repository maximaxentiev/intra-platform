export type ManualStaffFormValues = {
  displayName: string;
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

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
  const email = values.email.trim();
  if (!email) errors.email = "Email address is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}
