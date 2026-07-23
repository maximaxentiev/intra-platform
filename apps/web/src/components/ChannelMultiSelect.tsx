import { CENTRE_CHANNEL_OPTIONS, type CentreChannel } from "@/lib/db";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function ChannelMultiSelect({
  selected,
  exclude = [],
  onChange,
  label = "Add / remove channels",
}: {
  selected: CentreChannel[];
  exclude?: CentreChannel[];
  onChange: (channels: CentreChannel[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const excluded = new Set(exclude);
  const options = CENTRE_CHANNEL_OPTIONS.filter(o => !excluded.has(o.value));

  function toggle(channel: CentreChannel) {
    const next = selected.includes(channel)
      ? selected.filter(c => c !== channel)
      : [...selected, channel];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.length === 0 && <div className="text-sm text-muted-foreground">None selected.</div>}
        {selected.map(channel => {
          const opt = CENTRE_CHANNEL_OPTIONS.find(o => o.value === channel);
          return (
            <Badge key={channel} variant="secondary" className="gap-1">
              {opt?.label ?? channel}
              <button type="button" onClick={() => toggle(channel)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" type="button" className="justify-between">
            {label} <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>No channels available.</CommandEmpty>
              <CommandGroup>
                {options.map(({ value, label: channelLabel }) => {
                  const on = selected.includes(value);
                  return (
                    <CommandItem key={value} onSelect={() => toggle(value)}>
                      <Check className={`h-4 w-4 mr-2 ${on ? "opacity-100" : "opacity-0"}`} />
                      {channelLabel}
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
