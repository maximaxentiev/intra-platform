import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Staff } from "@/lib/db";
import { CityCombobox, validateCityField } from "@/components/CityCombobox";

export type StaffFormValues = Partial<Staff>;

export function StaffForm({
  initial,
  onSubmit,
}: {
  initial: StaffFormValues;
  onSubmit: (values: StaffFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<StaffFormValues>({
    legalName: "",
    displayName: "",
    useDisplayName: false,
    phone: "",
    email: "",
    role: "",
    status: "active",
    notes: "",
    documentsUrl: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [cityError, setCityError] = useState<string | undefined>();
  const savedCity = initial.city ?? "";
  const set = <K extends keyof StaffFormValues>(k: K, v: StaffFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!values.role) {
      toast.error("Please pick a role");
      return;
    }
    const nextCityError = validateCityField(values.city ?? "", savedCity);
    setCityError(nextCityError);
    if (nextCityError) return;
    setSaving(true);
    await onSubmit(values);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="legal">Legal full name *</Label>
        <Input
          id="legal"
          required
          value={values.legalName ?? ""}
          onChange={(e) => set("legalName", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="udn"
            checked={values.useDisplayName}
            onCheckedChange={(v) => set("useDisplayName", !!v)}
          />
          <Label htmlFor="udn" className="cursor-pointer">
            Use a different display name (e.g. to distinguish from another staff member with the same
            name)
          </Label>
        </div>
        {values.useDisplayName && (
          <Input
            placeholder="Display name shown across the platform"
            value={values.displayName ?? ""}
            onChange={(e) => set("displayName", e.target.value)}
          />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Role *</Label>
          <Select value={values.role || undefined} onValueChange={(v) => set("role", v)} required>
            <SelectTrigger>
              <SelectValue placeholder="Choose role..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ECA">ECA</SelectItem>
              <SelectItem value="ECE">ECE</SelectItem>
              <SelectItem value="Nanny">Nanny</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(v) => set("status", v as Staff["status"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Home address</Label>
        <Input
          id="address"
          value={values.address ?? ""}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <CityCombobox
        id="staff-city"
        label="City"
        value={values.city ?? ""}
        onChange={(city) => {
          set("city", city);
          setCityError(undefined);
        }}
        error={cityError}
      />
      <div className="space-y-2">
        <Label htmlFor="docs">Documents link (optional)</Label>
        <Input
          id="docs"
          type="url"
          placeholder="https://…"
          value={values.documentsUrl ?? ""}
          onChange={(e) => set("documentsUrl", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save staff"}
      </Button>
    </form>
  );
}
