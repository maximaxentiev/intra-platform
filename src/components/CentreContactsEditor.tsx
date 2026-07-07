import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type CentreContact } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", title: "", email: "", phone: "" };

export function CentreContactsEditor({ centreId }: { centreId: string }) {
  const qc = useQueryClient();

  const { data: contacts } = useQuery({
    queryKey: ["centre-contacts", centreId],
    queryFn: async () =>
      (await db.from("centre_contacts").select("*").eq("centre_id", centreId).order("sort_order")).data ?? [],
  });

  async function refresh() {
    qc.invalidateQueries({ queryKey: ["centre-contacts", centreId] });
  }

  async function addContact() {
    const maxOrder = (contacts ?? []).reduce((m: number, c: CentreContact) => Math.max(m, c.sort_order), -1);
    const { error } = await db.from("centre_contacts").insert({
      centre_id: centreId,
      ...EMPTY,
      sort_order: maxOrder + 1,
    });
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Contact added");
  }

  async function updateContact(id: string, patch: Partial<CentreContact>) {
    const { error } = await db.from("centre_contacts").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else await refresh();
  }

  async function deleteContact(id: string) {
    const { error } = await db.from("centre_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Contact removed");
  }

  async function moveContact(index: number, direction: -1 | 1) {
    const list = [...(contacts ?? [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    await Promise.all(
      list.map((c, i) => db.from("centre_contacts").update({ sort_order: i }).eq("id", c.id)),
    );
    await refresh();
  }

  const priorityLabel = (index: number, total: number) => {
    if (index === 0) return "Primary contact";
    if (index === 1) return "Secondary contact";
    return `Contact ${index + 1} of ${total}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Centre contacts</h3>
          <p className="text-xs text-muted-foreground">Order matters — the first contact is the primary contact.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addContact}>
          <Plus className="h-4 w-4 mr-1" /> Add contact
        </Button>
      </div>

      {(contacts ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground italic">No contacts yet. Add the centre&apos;s primary contact.</p>
      )}

      <div className="space-y-3">
        {(contacts ?? []).map((c: CentreContact, index: number) => (
          <div key={c.id} className="rounded-md border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {priorityLabel(index, (contacts ?? []).length)}
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => moveContact(index, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === (contacts ?? []).length - 1} onClick={() => moveContact(index, 1)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteContact(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input defaultValue={c.name} onBlur={e => updateContact(c.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role / title</Label>
                <Input defaultValue={c.title} onBlur={e => updateContact(c.id, { title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" defaultValue={c.email} onBlur={e => updateContact(c.id, { email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input defaultValue={c.phone} onBlur={e => updateContact(c.id, { phone: e.target.value })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
