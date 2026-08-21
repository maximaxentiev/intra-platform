import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { centresApi } from "@/lib/db";
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
 * Compact presentation of Top / Banned centre preferences.
 *
 * Behaviour is unchanged: every add/remove sends the full centre id array to
 * the existing endpoint, and mutual exclusion stays server-side, surfaced here
 * through `excludeIds`.
 */
export function StaffCentrePreferences({
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
  const { data: centres } = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const excluded = new Set(excludeIds);
  const options = (centres ?? []).filter(
    (c) => !excluded.has(c.id) || selectedIds.includes(c.id),
  );
  const byId = new Map((centres ?? []).map((c) => [c.id, c]));

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
              <Plus className="h-4 w-4" aria-hidden /> Add centre
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search centres…" />
              <CommandList>
                <CommandEmpty>No centres found.</CommandEmpty>
                <CommandGroup>
                  {options.map((c) => {
                    const on = selectedIds.includes(c.id);
                    return (
                      <CommandItem key={c.id} onSelect={() => toggle(c.id)}>
                        <Check className={`mr-2 h-4 w-4 ${on ? "opacity-100" : "opacity-0"}`} />
                        {c.name}
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
            const centre = byId.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0 truncate text-sm">{centre?.name ?? "Unknown centre"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${centre?.name ?? "centre"} from ${title}`}
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
