import { useId, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Extra text matched by the built-in filter (codes, cities, emails). */
  keywords?: string;
};

/**
 * Low-level searchable select built on the existing Command + Popover.
 *
 * Domain components (SearchableCentreSelect, CityCombobox, staff selectors)
 * keep their own data fetching and filtering rules; they can pass pre-filtered
 * options here and set `filter={false}` to opt out of client-side matching.
 */
export function ComboboxField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  disabled,
  filter = true,
  onSearchChange,
  id,
  className,
  contentClassName,
  footer,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Set false when the caller filters options itself (server search). */
  filter?: boolean;
  onSearchChange?: (search: string) => void;
  id?: string;
  className?: string;
  contentClassName?: string;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label ? undefined : placeholder}
            disabled={disabled}
            className="h-9 w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("w-[--radix-popover-trigger-width] p-0", contentClassName)}
        >
          <Command shouldFilter={filter}>
            <CommandInput placeholder={searchPlaceholder} onValueChange={onSearchChange} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.keywords ?? ""}`}
                    disabled={option.disabled}
                    onSelect={() => {
                      onChange(option.value === value ? null : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {footer}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
