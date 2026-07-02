import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, toDateStr } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shifts/new")({
  component: NewShift,
});

function NewShift() {
  const navigate = useNavigate();
  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: async () => (await db.from("centres").select("id, name").order("name")).data ?? [],
  });
  const [values, setValues] = useState<any>({
    centre_id: "",
    shift_date: toDateStr(new Date()),
    start_time: "08:00",
    end_time: "16:00",
    role_needed: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setValues((prev: any) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.centre_id) { toast.error("Please pick a centre"); return; }
    setSaving(true);
    const payload = { ...values, start_time: values.start_time + ":00", end_time: values.end_time + ":00", status: "pending" };
    const { data, error } = await db.from("shifts").insert(payload).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Shift created");
    navigate({ to: "/shifts/$id", params: { id: data.id } });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Create shift</h1>
      <p className="text-sm text-muted-foreground">Save the shift now — you can find and assign staff on the next screen.</p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Centre *</Label>
              <Select value={values.centre_id} onValueChange={v => set("centre_id", v)}>
                <SelectTrigger><SelectValue placeholder="Choose centre..." /></SelectTrigger>
                <SelectContent>
                  {(centresQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="d">Date *</Label>
                <Input id="d" type="date" required value={values.shift_date} onChange={e => set("shift_date", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st">Start time *</Label>
                <Input id="st" type="time" required value={values.start_time} onChange={e => set("start_time", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="et">End time *</Label>
                <Input id="et" type="time" required value={values.end_time} onChange={e => set("end_time", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role needed</Label>
              <Input id="role" placeholder="e.g. Early Childhood Educator" value={values.role_needed} onChange={e => set("role_needed", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (internal)</Label>
              <Textarea id="notes" rows={3} value={values.notes} onChange={e => set("notes", e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save shift"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
