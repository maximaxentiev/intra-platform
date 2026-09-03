import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelMultiSelect } from "@/components/ChannelMultiSelect";
import { CityCombobox, validateCityField } from "@/components/CityCombobox";
import { CENTRE_CHANNEL_OPTIONS, type CentreChannel } from "@/lib/db";

export type CentreFormValues = {
  name: string;
  address: string;
  city: string;
  primaryChannel: CentreChannel;
  notes: string;
  internalOpsNotes: string;
};

export function CentreForm({
  initial,
  secondaryChannels = [],
  onSubmit,
  submitLabel = "Save centre",
  savingLabel = "Saving...",
  onCancel,
}: {
  initial: Partial<CentreFormValues & { hourlyRate?: string | null }>;
  secondaryChannels?: CentreChannel[];
  onSubmit: (values: CentreFormValues, secondary: CentreChannel[]) => Promise<void>;
  submitLabel?: string;
  savingLabel?: string;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<CentreFormValues>({
    name: initial.name ?? "",
    address: initial.address ?? "",
    city: initial.city ?? "",
    notes: initial.notes ?? "",
    internalOpsNotes: initial.internalOpsNotes ?? "",
    primaryChannel: initial.primaryChannel ?? "email",
  });
  const [secondary, setSecondary] = useState<CentreChannel[]>(secondaryChannels);
  const [saving, setSaving] = useState(false);
  const [cityError, setCityError] = useState<string | undefined>();
  const savedCity = initial.city ?? "";
  const set = (k: keyof CentreFormValues, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextCityError = validateCityField(values.city, savedCity);
    setCityError(nextCityError);
    if (nextCityError) return;
    setSaving(true);
    const cleanedSecondary = secondary.filter((c) => c !== values.primaryChannel);
    await onSubmit(values, cleanedSecondary);
    setSecondary(cleanedSecondary);
    setSaving(false);
  }

  function onPrimaryChange(channel: CentreChannel) {
    set("primaryChannel", channel);
    setSecondary((prev) => prev.filter((c) => c !== channel));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Centre name *</Label>
          <Input id="name" required value={values.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={values.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <CityCombobox
            id="centre-city"
            label="City"
            value={values.city}
            onChange={(city) => {
              set("city", city);
              setCityError(undefined);
            }}
            error={cityError}
          />
        </div>
      </div>

      <div className="space-y-4 border-t border-border/70 pt-6">
        <div className="space-y-2">
          <Label>Primary communication channel</Label>
          <Select value={values.primaryChannel} onValueChange={(v) => onPrimaryChange(v as CentreChannel)}>
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CENTRE_CHANNEL_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Secondary communication channels</Label>
          <ChannelMultiSelect
            selected={secondary}
            exclude={[values.primaryChannel]}
            onChange={setSecondary}
            label="Add secondary channels"
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border/70 pt-6">
        <Label htmlFor="notes">Rules, Policies, and Other Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Parking, entry, age groups, expectations..."
        />
      </div>

      <div className="space-y-2 border-t border-border/70 pt-6">
        <Label htmlFor="internalOpsNotes">Internal Ops Notes</Label>
        <p className="text-xs text-muted-foreground">
          Visible to the Intra Ops team only. This is never shared with Centres or Carers.
        </p>
        <Textarea
          id="internalOpsNotes"
          rows={4}
          value={values.internalOpsNotes}
          onChange={(e) => set("internalOpsNotes", e.target.value)}
          placeholder="Internal handling instructions, operational context, account reminders..."
        />
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center">
        <Button type="submit" disabled={saving}>
          {saving ? savingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
