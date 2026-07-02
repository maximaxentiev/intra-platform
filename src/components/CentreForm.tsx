import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CentreForm({ initial, onSubmit }: { initial: any; onSubmit: (values: any) => Promise<void> }) {
  const [values, setValues] = useState<any>({
    name: "",
    address: "",
    contact_name: "",
    contact_title: "",
    contact_phone: "",
    contact_email: "",
    preferred_channel: "email",
    notes: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setValues((prev: any) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSubmit(values);
    setSaving(false);
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cn">Primary contact name</Label>
          <Input id="cn" value={values.contact_name} onChange={e => set("contact_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ct">Contact title</Label>
          <Input id="ct" value={values.contact_title} onChange={e => set("contact_title", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp">Contact phone</Label>
          <Input id="cp" value={values.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ce">Contact email</Label>
          <Input id="ce" type="email" value={values.contact_email} onChange={e => set("contact_email", e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Preferred communication channel</Label>
        <Select value={values.preferred_channel} onValueChange={v => set("preferred_channel", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="goto">GoTo</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={e => set("notes", e.target.value)} placeholder="Parking, entry, age groups, expectations..." />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save centre"}</Button>
    </form>
  );
}
