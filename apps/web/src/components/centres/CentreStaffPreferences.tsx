import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffApi, displayStaff } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SectionCard } from "@/components/ui-kit";
import { Check, Plus, X } from "lucide-react";

/**
 * Compact presentation of a centre's Top / Banned staff list.
 *
 * Mirrors StaffCentrePreferences. Behaviour is unchanged: every add/remove
 * sends the full staff id array to the existing endpoint, and mutual
 * exclusion stays server-side, surfaced here through `excludeIds`.
 */
export function CentreStaffPreferences({
  title,
  description,
  emptyText,
  selectedIds,
  excludeIds,
  onChange,
}: {
  title: string;
  description: string;
  emptyText: string;
  selectedIds: string[];
  excludeIds: string[];
  onChange: (ids: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({
    queryKey: ["staff-all"],
    queryFn: () => staffApi.list(),
  });

  const excluded = new Set(excludeIds);
  const options = (staff ?? []).filter(
    (s) => !excluded.has(s.id) || selectedIds.includes(s.id),
  );
  const byId = new Map((staff ?? []).map((s) => [s.id, s]));

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    void onChange(next);
  }

  return (
    <SectionCard
      title={title}
      description={description}
      action={
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4" aria-hidden /> Add staff
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search staff…" />
              <CommandList>
                <CommandEmpty>No staff found.</CommandEmpty>
                <CommandGroup>
                  {options.map((s) => {
                    const on = selectedIds.includes(s.id);
                    return (
                      <CommandItem key={s.id} value={displayStaff(s)} onSelect={() => toggle(s.id)}>
                        <Check className={`mr-2 h-4 w-4 ${on ? "opacity-100" : "opacity-0"}`} />
                        {displayStaff(s)}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      }
    >
      {selectedIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {selectedIds.map((id) => {
            const person = byId.get(id);
            const name = person ? displayStaff(person) : "Unknown staff member";
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 truncate text-sm">{name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${name} from ${title}`}
                  onClick={() => toggle(id)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
