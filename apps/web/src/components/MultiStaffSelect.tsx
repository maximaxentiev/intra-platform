import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { staffApi, displayStaff } from "@/lib/db";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

export function MultiStaffSelect({
  selectedIds,
  excludeIds = [],
  onChange,
}: {
  selectedIds: string[];
  excludeIds?: string[];
  onChange: (ids: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({
    queryKey: ["staff-all"],
    queryFn: () => staffApi.list(),
  });
  const excluded = new Set(excludeIds);
  const options = (staff ?? []).filter((s) => !excluded.has(s.id) || selectedIds.includes(s.id));
  const byId = new Map((staff ?? []).map((s) => [s.id, s]));

  function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedIds.length === 0 && <div className="text-sm text-muted-foreground">None selected.</div>}
        {selectedIds.map(id => {
          const s = byId.get(id);
          if (!s) return null;
          return (
            <Badge key={id} variant="secondary" className="gap-1">
              {displayStaff(s)}
              <button type="button" onClick={() => toggle(id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="justify-between">
            Add / remove staff <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search staff..." />
            <CommandList>
              <CommandEmpty>No staff found.</CommandEmpty>
              <CommandGroup>
                {options.map((s) => {
                  const on = selectedIds.includes(s.id);
                  return (
                    <CommandItem key={s.id} onSelect={() => toggle(s.id)}>
                      <Check className={`h-4 w-4 mr-2 ${on ? "opacity-100" : "opacity-0"}`} />
                      {displayStaff(s)}
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
