import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export function StaffForm({ initial, onSubmit }: { initial: any; onSubmit: (values: any) => Promise<void> }) {
  const [values, setValues] = useState<any>({
    legal_name: "",
    display_name: "",
    use_display_name: false,
    phone: "",
    email: "",
    role: "",
    status: "active",
    notes: "",
    documents_url: "",
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
        <Label htmlFor="legal">Legal full name *</Label>
        <Input id="legal" required value={values.legal_name} onChange={e => set("legal_name", e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="udn" checked={values.use_display_name} onCheckedChange={v => set("use_display_name", !!v)} />
          <Label htmlFor="udn" className="cursor-pointer">Use a different display name (e.g. to distinguish from another staff member with the same name)</Label>
        </div>
        {values.use_display_name && (
          <Input placeholder="Display name shown across the platform" value={values.display_name} onChange={e => set("display_name", e.target.value)} />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={values.phone} onChange={e => set("phone", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={values.email} onChange={e => set("email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role (e.g. Early Childhood Educator)</Label>
          <Input id="role" value={values.role} onChange={e => set("role", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={values.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="docs">Documents link (OneDrive URL)</Label>
        <Input id="docs" type="url" placeholder="https://..." value={values.documents_url} onChange={e => set("documents_url", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={e => set("notes", e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save staff"}</Button>
    </form>
  );
}
