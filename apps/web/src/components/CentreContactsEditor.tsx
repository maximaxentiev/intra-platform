import { useQuery, useQueryClient } from "@tanstack/react-query";
import { centresApi, type CentreContact } from "@/lib/db";
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
    queryFn: () => centresApi.contacts(centreId),
  });

  async function refresh() {
    qc.invalidateQueries({ queryKey: ["centre-contacts", centreId] });
  }

  async function addContact() {
    try {
      await centresApi.addContact(centreId, EMPTY);
      await refresh();
      toast.success("Contact added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  }

  async function updateContact(id: string, patch: Partial<CentreContact>) {
    try {
      await centresApi.updateContact(id, patch);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function deleteContact(id: string) {
    try {
      await centresApi.removeContact(id);
      await refresh();
      toast.success("Contact removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function moveContact(index: number, direction: -1 | 1) {
    const list = [...(contacts ?? [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    try {
      await centresApi.reorderContacts(centreId, list.map((c) => c.id));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
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
        {(contacts ?? []).map((c, index) => (
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
