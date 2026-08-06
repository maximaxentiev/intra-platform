import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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

  function field(id: keyof ManualStaffFormValues, label: string, type = "text", autoComplete?: string, hint?: string) {
    return (
      <div className="space-y-1.5 min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          className="h-11"
          value={values[id]}
          onChange={(e) => set(id, e.target.value)}
          aria-invalid={Boolean(errors[id])}
          aria-describedby={errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        {errors[id] ? (
          <p id={`${id}-error`} className="text-sm text-destructive">
            {errors[id]}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-full overflow-x-hidden" noValidate>
      {errorCount > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Please fix {errorCount} {errorCount === 1 ? "field" : "fields"} below.
        </div>
      )}

      <section className="space-y-4 min-w-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Identity
        </h2>
        {field("displayName", "Display name", "text", undefined, "Shown across shifts and centre lists.")}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("legalFirstName", "Legal first name", "text", "given-name")}
          {field("legalLastName", "Legal last name", "text", "family-name")}
        </div>
      </section>

      <section className="space-y-4 min-w-0 border-t border-border/70 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contact
        </h2>
        {field("email", "Email address", "email", "email", "Used for their portal invitation.")}
        {field("phone", "Phone number", "tel", "tel")}
      </section>

      <section className="space-y-4 min-w-0 border-t border-border/70 pt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Location
        </h2>
        {field("address", "Home address", "text", "street-address")}
        {field("city", "City", "text", "address-level2")}
      </section>

      <div className="flex flex-col gap-2 border-t border-border/70 pt-6 sm:flex-row">
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
          {saving ? "Creating…" : "Create staff member"}
        </Button>
        <p className="text-xs text-muted-foreground sm:self-center">
          You can send their portal invitation from the profile afterwards.
        </p>
      </div>
    </form>
  );
}
