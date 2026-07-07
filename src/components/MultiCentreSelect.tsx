import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/db";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

export function MultiCentreSelect({
  selectedIds,
  excludeIds = [],
  onChange,
}: {
  selectedIds: string[];
  excludeIds?: string[];
  onChange: (ids: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data: centres } = useQuery({
    queryKey: ["centres-all"],
    queryFn: async () => (await db.from("centres").select("id, name").order("name")).data ?? [],
  });
  const excluded = new Set(excludeIds);
  const options = (centres ?? []).filter((c: any) => !excluded.has(c.id) || selectedIds.includes(c.id));
  const byId = new Map<string, any>((centres ?? []).map((c: any) => [c.id, c]));

  function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedIds.length === 0 && <div className="text-sm text-muted-foreground">None selected.</div>}
        {selectedIds.map(id => {
          const c = byId.get(id);
          if (!c) return null;
          return (
            <Badge key={id} variant="secondary" className="gap-1">
              {c.name}
              <button type="button" onClick={() => toggle(id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">Add / remove centres <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search centres..." />
            <CommandList>
              <CommandEmpty>No centres found.</CommandEmpty>
              <CommandGroup>
                {options.map((c: any) => {
                  const on = selectedIds.includes(c.id);
                  return (
                    <CommandItem key={c.id} onSelect={() => toggle(c.id)}>
                      <Check className={`h-4 w-4 mr-2 ${on ? "opacity-100" : "opacity-0"}`} />
                      {c.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
