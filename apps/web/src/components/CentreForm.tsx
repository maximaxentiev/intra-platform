import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelMultiSelect } from "@/components/ChannelMultiSelect";
import { CityCombobox, validateCityField } from "@/components/CityCombobox";
import { CENTRE_CHANNEL_OPTIONS, type CentreChannel } from "@/lib/db";

export type CentreEceQualificationRequirement = "ece_or_rece" | "rece_required";

export type CentreFormValues = {
  name: string;
  address: string;
  city: string;
  hourlyRate: string;
  primaryChannel: CentreChannel;
  notes: string;
  requiresQualificationForMatching: boolean;
  eceQualificationRequirement: CentreEceQualificationRequirement;
};

export function CentreForm({
  initial,
  secondaryChannels = [],
  onSubmit,
  submitLabel = "Save centre",
  savingLabel = "Saving...",
  onCancel,
}: {
  initial: Partial<
    Omit<CentreFormValues, "hourlyRate"> & {
      hourlyRate?: string | null;
      requiresQualificationForMatching?: boolean;
      eceQualificationRequirement?: CentreEceQualificationRequirement;
    }
  >;
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
    hourlyRate: initial.hourlyRate != null ? String(initial.hourlyRate) : "",
    notes: initial.notes ?? "",
    primaryChannel: initial.primaryChannel ?? "email",
    requiresQualificationForMatching: initial.requiresQualificationForMatching ?? false,
    eceQualificationRequirement: initial.eceQualificationRequirement ?? "ece_or_rece",
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
    await onSubmit(
      {
        ...values,
        hourlyRate: values.hourlyRate.trim(),
      },
      cleanedSecondary,
    );
    setSecondary(cleanedSecondary);
    setSaving(false);
  }

  function onPrimaryChange(channel: CentreChannel) {
    set("primaryChannel", channel);
    setSecondary((prev) => prev.filter((c) => c !== channel));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Group 1 — identity & location */}
      <fieldset className="space-y-4">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Centre identity
        </legend>
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
      </fieldset>

      {/* Group 2 — commercial terms */}
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Commercial terms
        </legend>
        <Label htmlFor="hourlyRate">Hourly Rate</Label>
        <p className="text-[13px] text-muted-foreground">
          Stores the agreed hourly rate for this centre.
        </p>
        <Input
          id="hourlyRate"
          inputMode="decimal"
          placeholder="28.50"
          className="sm:max-w-[200px]"
          value={values.hourlyRate}
          onChange={(e) => set("hourlyRate", e.target.value)}
        />
      </fieldset>

      {/* Group 3 — how ops contacts this centre */}
      <fieldset className="space-y-4">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Communication
        </legend>
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
      </fieldset>

      {/* Group 4 — operational instructions */}
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Rules & notes
        </legend>
        <Label htmlFor="notes">Rules, Policies, and Other Notes</Label>
        <p className="text-[13px] text-muted-foreground">
          These instructions are shared with carers when they are assigned to shifts at this centre.
        </p>
        <Textarea
          id="notes"
          rows={4}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Parking, entry, age groups, expectations..."
        />
      </fieldset>

      {/* Group 5 — shift matching qualifications */}
      <fieldset className="space-y-4">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Shift matching
        </legend>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="requiresQualificationForMatching">
              Require qualification for Staff matching
            </Label>
            <p className="text-[13px] text-muted-foreground">
              When enabled, only Staff with an approved qualification that meets this Centre&apos;s
              requirement will appear in Shift matching.
            </p>
          </div>
          <Switch
            id="requiresQualificationForMatching"
            checked={values.requiresQualificationForMatching}
            onCheckedChange={(checked) =>
              setValues((prev) => ({ ...prev, requiresQualificationForMatching: checked }))
            }
          />
        </div>
        {values.requiresQualificationForMatching ? (
          <div className="space-y-2 sm:max-w-md">
            <Label htmlFor="eceQualificationRequirement">ECE requirement</Label>
            <Select
              value={values.eceQualificationRequirement}
              onValueChange={(value) =>
                set("eceQualificationRequirement", value as CentreEceQualificationRequirement)
              }
            >
              <SelectTrigger id="eceQualificationRequirement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ece_or_rece">ECE qualification accepted</SelectItem>
                <SelectItem value="rece_required">RECE required</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[13px] text-muted-foreground">
              For ECE staff, choose whether an approved ECE diploma or RECE proof satisfies this
              centre&apos;s requirement.
            </p>
          </div>
        ) : null}
      </fieldset>

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
