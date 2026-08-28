import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { centresApi, type CentreContact } from "@/lib/db";
import {
  contactDetailLines,
  contactDisplayName,
  contactDraftHasContent,
  isPrimaryContact,
  reorderedContactIds,
  type ContactDraftFields,
} from "@/lib/centres-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionCard, SectionLoading, ConfirmDestructiveDialog } from "@/components/ui-kit";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY_DRAFT: ContactDraftFields = { name: "", title: "", email: "", phone: "" };

/**
 * Centre contacts, read-first.
 *
 * New contacts use a local draft with explicit Save/Discard. Persisted contacts
 * still PATCH individual fields on blur — order remains the primary signal.
 */
export function CentreContactsEditor({ centreId }: { centreId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<CentreContact | null>(null);
  const [draft, setDraft] = useState<ContactDraftFields | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["centre-contacts", centreId],
    queryFn: () => centresApi.contacts(centreId),
  });

  const list = contacts ?? [];

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["centre-contacts", centreId] });
    await qc.invalidateQueries({ queryKey: ["centres"] });
  }

  function toggleEditing(id: string, on?: boolean) {
    setEditing((prev) => {
      const next = new Set(prev);
      const shouldOpen = on ?? !next.has(id);
      if (shouldOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openDraft() {
    setDraft({ ...EMPTY_DRAFT });
  }

  function discardDraft() {
    setDraft(null);
  }

  async function saveDraft() {
    if (!draft) return;
    if (!contactDraftHasContent(draft)) {
      toast.error("Enter at least one contact detail before saving.");
      return;
    }
    setSavingDraft(true);
    try {
      await centresApi.addContact(centreId, draft);
      await refresh();
      setDraft(null);
      toast.success("Contact added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSavingDraft(false);
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

  async function deleteContact(contact: CentreContact) {
    try {
      await centresApi.removeContact(contact.id);
      await refresh();
      toast.success("Contact removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingDelete(null);
    }
  }

  async function moveContact(index: number, direction: -1 | 1) {
    const ids = reorderedContactIds(list, index, direction);
    if (!ids) return;
    try {
      await centresApi.reorderContacts(centreId, ids);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  return (
    <SectionCard
      title="Contacts"
      action={
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={openDraft}
          disabled={draft !== null}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add contact
        </Button>
      }
      padded={false}
    >
      {isLoading ? (
        <div className="px-4 py-3.5">
          <SectionLoading />
        </div>
      ) : (
        <>
          {draft && (
            <div className="border-b border-border/60 px-4 py-3">
              <p className="mb-3 text-sm font-medium text-foreground">New contact</p>
              <div className="grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-draft-name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="contact-draft-name"
                    value={draft.name}
                    onChange={(e) => setDraft((prev) => prev && { ...prev, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-draft-title" className="text-xs">
                    Role / title
                  </Label>
                  <Input
                    id="contact-draft-title"
                    value={draft.title}
                    onChange={(e) => setDraft((prev) => prev && { ...prev, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-draft-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="contact-draft-email"
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft((prev) => prev && { ...prev, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-draft-phone" className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id="contact-draft-phone"
                    value={draft.phone}
                    onChange={(e) => setDraft((prev) => prev && { ...prev, phone: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="button" size="sm" onClick={() => void saveDraft()} disabled={savingDraft}>
                    {savingDraft ? "Saving…" : "Save contact"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={discardDraft} disabled={savingDraft}>
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          )}

          {list.length === 0 && !draft ? (
            <p className="px-4 py-3.5 text-sm text-muted-foreground">
              No contacts yet. Add the centre&apos;s primary contact.
            </p>
          ) : list.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {list.map((c, index) => {
                const open = editing.has(c.id);
                const name = contactDisplayName(c);
                const details = contactDetailLines(c);
                return (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{name}</span>
                          {isPrimaryContact(index) && (
                            <Badge variant="secondary" className="font-normal">
                              Primary
                            </Badge>
                          )}
                        </div>
                        {c.title?.trim() && (
                          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{c.title}</p>
                        )}
                        {details.length > 0 && (
                          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                            {details.join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={index === 0}
                          aria-label={`Move ${name} up`}
                          onClick={() => moveContact(index, -1)}
                        >
                          <ChevronUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={index === list.length - 1}
                          aria-label={`Move ${name} down`}
                          onClick={() => moveContact(index, 1)}
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          aria-expanded={open}
                          onClick={() => toggleEditing(c.id)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:ml-1">
                            {open ? "Done" : "Edit"}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${name}`}
                          onClick={() => setPendingDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-3 grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`contact-name-${c.id}`} className="text-xs">
                            Name
                          </Label>
                          <Input
                            id={`contact-name-${c.id}`}
                            defaultValue={c.name}
                            onBlur={(e) => updateContact(c.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`contact-title-${c.id}`} className="text-xs">
                            Role / title
                          </Label>
                          <Input
                            id={`contact-title-${c.id}`}
                            defaultValue={c.title}
                            onBlur={(e) => updateContact(c.id, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`contact-email-${c.id}`} className="text-xs">
                            Email
                          </Label>
                          <Input
                            id={`contact-email-${c.id}`}
                            type="email"
                            defaultValue={c.email}
                            onBlur={(e) => updateContact(c.id, { email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`contact-phone-${c.id}`} className="text-xs">
                            Phone
                          </Label>
                          <Input
                            id={`contact-phone-${c.id}`}
                            defaultValue={c.phone}
                            onBlur={(e) => updateContact(c.id, { phone: e.target.value })}
                          />
                        </div>
                        <p className="text-[13px] text-muted-foreground sm:col-span-2">
                          Changes save automatically when you leave a field.
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}

      <ConfirmDestructiveDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove this contact?"
        consequence={`${pendingDelete ? contactDisplayName(pendingDelete) : "This contact"} will be removed from the centre. This cannot be undone.`}
        details="If they were the primary contact, the next contact in the list becomes primary."
        confirmLabel="Remove contact"
        onConfirm={() => pendingDelete && void deleteContact(pendingDelete)}
      />
    </SectionCard>
  );
}
