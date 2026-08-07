/** Shared validation for carer personal information (onboarding Step 1 and future profile). */

export type PersonalProfileFields = {
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

export type PersonalProfileFieldKey = keyof PersonalProfileFields;

export function personalProfileFromSession(session: PersonalProfileFields): PersonalProfileFields {
  return {
    legalFirstName: session.legalFirstName,
    legalLastName: session.legalLastName,
    email: session.email,
    phone: session.phone,
    address: session.address,
    city: session.city,
  };
}

export function validatePersonalProfileFields(
  values: PersonalProfileFields,
): Partial<Record<PersonalProfileFieldKey, string>> {
  const errors: Partial<Record<PersonalProfileFieldKey, string>> = {};
  if (!values.legalFirstName.trim()) errors.legalFirstName = "Legal first name is required.";
  if (!values.legalLastName.trim()) errors.legalLastName = "Legal last name is required.";
  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.phone.trim()) errors.phone = "Phone number is required.";
  if (!values.address.trim()) errors.address = "Home address is required.";
  if (!values.city.trim()) errors.city = "City is required.";
  return errors;
}

export function personalProfileDirty(
  a: PersonalProfileFields,
  b: PersonalProfileFields,
): boolean {
  return (
    a.legalFirstName !== b.legalFirstName ||
    a.legalLastName !== b.legalLastName ||
    a.email.trim().toLowerCase() !== b.email.trim().toLowerCase() ||
    a.phone !== b.phone ||
    a.address !== b.address ||
    a.city !== b.city
  );
}

export function trimPersonalProfile(values: PersonalProfileFields): PersonalProfileFields {
  return {
    legalFirstName: values.legalFirstName.trim(),
    legalLastName: values.legalLastName.trim(),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
  };
}
