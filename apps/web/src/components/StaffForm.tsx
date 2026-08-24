import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Staff, StaffDetail } from "@/lib/db";
import { CityCombobox, validateCityField } from "@/components/CityCombobox";
import {
  buildStaffUpdatePayload,
  pickStaffFormEditableInitial,
  type StaffFormEditableValues,
  type StaffUpdatePayload,
} from "@/lib/staff-form-payload";

export function StaffForm({
  initial,
  onSubmit,
}: {
  initial: StaffDetail | Partial<StaffFormEditableValues>;
  onSubmit: (values: StaffUpdatePayload) => Promise<void>;
}) {
  const savedCity = String(initial.city ?? "");
  const [values, setValues] = useState<StaffFormEditableValues>(() =>
    pickStaffFormEditableInitial(initial),
  );
  const [saving, setSaving] = useState(false);
  const [cityError, setCityError] = useState<string | undefined>();
  const set = <K extends keyof StaffFormEditableValues>(k: K, v: StaffFormEditableValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!values.role) {
      toast.error("Please pick a role");
      return;
    }
    const nextCityError = validateCityField(values.city, savedCity);
    setCityError(nextCityError);
    if (nextCityError) return;

    const payload = buildStaffUpdatePayload(values, savedCity);
    if (!payload) {
      setCityError("City must be selected from the supported city list.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="legal">Legal full name *</Label>
        <Input
          id="legal"
          required
          value={values.legalName}
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
            value={values.displayName}
            onChange={(e) => set("displayName", e.target.value)}
          />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
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
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <CityCombobox
        id="staff-city"
        label="City"
        value={values.city}
        onChange={(city) => {
          set("city", city);
          setCityError(undefined);
        }}
        error={cityError}
      />
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save staff"}
      </Button>
    </form>
  );
}
