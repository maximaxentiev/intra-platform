import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelMultiSelect } from "@/components/ChannelMultiSelect";
import { CENTRE_CHANNEL_OPTIONS, type CentreChannel } from "@/lib/db";

export type CentreFormValues = {
  name: string;
  address: string;
  primary_channel: CentreChannel;
  notes: string;
};

export function CentreForm({
  initial,
  secondaryChannels = [],
  onSubmit,
}: {
  initial: Partial<CentreFormValues & { primary_channel?: CentreChannel; preferred_channel?: CentreChannel }>;
  secondaryChannels?: CentreChannel[];
  onSubmit: (values: CentreFormValues, secondary: CentreChannel[]) => Promise<void>;
}) {
  const [values, setValues] = useState<CentreFormValues>({
    name: "",
    address: "",
    primary_channel: "email",
    notes: "",
    ...initial,
    primary_channel: initial.primary_channel ?? initial.preferred_channel ?? "email",
  });
  const [secondary, setSecondary] = useState<CentreChannel[]>(secondaryChannels);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CentreFormValues, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const cleanedSecondary = secondary.filter(c => c !== values.primary_channel);
    await onSubmit(values, cleanedSecondary);
    setSecondary(cleanedSecondary);
    setSaving(false);
  }

  function onPrimaryChange(channel: CentreChannel) {
    set("primary_channel", channel);
    setSecondary(prev => prev.filter(c => c !== channel));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Centre name *</Label>
        <Input id="name" required value={values.name} onChange={e => set("name", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" value={values.address} onChange={e => set("address", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Primary communication channel</Label>
        <Select value={values.primary_channel} onValueChange={v => onPrimaryChange(v as CentreChannel)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CENTRE_CHANNEL_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Secondary communication channels</Label>
        <ChannelMultiSelect
          selected={secondary}
          exclude={[values.primary_channel]}
          onChange={setSecondary}
          label="Add secondary channels"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={e => set("notes", e.target.value)} placeholder="Parking, entry, age groups, expectations..." />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save centre"}</Button>
    </form>
  );
}
