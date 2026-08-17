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
};

export function CentreForm({
  initial,
  secondaryChannels = [],
  onSubmit,
}: {
  initial: Partial<CentreFormValues>;
  secondaryChannels?: CentreChannel[];
  onSubmit: (values: CentreFormValues, secondary: CentreChannel[]) => Promise<void>;
}) {
  const [values, setValues] = useState<CentreFormValues>({
    name: initial.name ?? "",
    address: initial.address ?? "",
    city: initial.city ?? "",
    notes: initial.notes ?? "",
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
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Centre name *</Label>
        <Input id="name" required value={values.name} onChange={(e) => set("name", e.target.value)} />
      </div>
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
      <div className="space-y-2">
        <Label>Primary communication channel</Label>
        <Select value={values.primaryChannel} onValueChange={(v) => onPrimaryChange(v as CentreChannel)}>
          <SelectTrigger>
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
      <div className="space-y-2">
        <Label htmlFor="notes">Rules, Policies, and Other Notes</Label>
        <p className="text-sm text-muted-foreground">
          These instructions are shared with carers when they are assigned to shifts at this centre.
        </p>
        <Textarea
          id="notes"
          rows={4}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Parking, entry, age groups, expectations..."
        />
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save centre"}
      </Button>
    </form>
  );
}
