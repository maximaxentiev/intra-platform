import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validateManualStaffForm,
  type ManualStaffFormValues,
} from "@/lib/manual-staff-form.validation";

export function ManualStaffCreateForm({
  onSubmit,
}: {
  onSubmit: (values: ManualStaffFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ManualStaffFormValues>({
    displayName: "",
    legalFirstName: "",
    legalLastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ManualStaffFormValues, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ManualStaffFormValues>(key: K, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateManualStaffForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      await onSubmit({
        displayName: values.displayName.trim(),
        legalFirstName: values.legalFirstName.trim(),
        legalLastName: values.legalLastName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  function field(id: keyof ManualStaffFormValues, label: string, type = "text", autoComplete?: string) {
    return (
      <div className="space-y-2 min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          className="h-11"
          value={values[id]}
          onChange={(e) => set(id, e.target.value)}
          aria-invalid={Boolean(errors[id])}
          aria-describedby={errors[id] ? `${id}-error` : undefined}
        />
        {errors[id] ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {errors[id]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-full overflow-x-hidden">
      {field("displayName", "Display name *")}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("legalFirstName", "Legal first name *", "text", "given-name")}
        {field("legalLastName", "Legal last name *", "text", "family-name")}
      </div>
      {field("email", "Email address *", "email", "email")}
      {field("phone", "Phone number *", "tel", "tel")}
      {field("address", "Home address *", "text", "street-address")}
      {field("city", "City *", "text", "address-level2")}
      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
        {saving ? "Creating…" : "Create staff member"}
      </Button>
    </form>
  );
}
