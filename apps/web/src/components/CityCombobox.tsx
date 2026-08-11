import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  cityComboboxOptions,
  filterSupportedCities,
  isSupportedCity,
  normalizeSupportedCity,
  UNSUPPORTED_CITY_MESSAGE,
} from "@intra/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";

export function CityCombobox({
  id,
  label,
  value,
  onChange,
  error,
  required = true,
  className,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const displayOptions = cityComboboxOptions(value);
  const filtered = filterSupportedCities(search).filter((city) => displayOptions.includes(city));
  const legacyOnly =
    value.trim() && !isSupportedCity(value) && filtered.length === 0 && !search.trim();
  const showLegacy =
    legacyOnly && value.trim().toLowerCase().includes(search.trim().toLowerCase());

  function selectCity(city: string) {
    onChange(city);
    setOpen(false);
    setSearch("");
  }

  function clearCity() {
    onChange("");
    setSearch("");
  }

  const describedBy = [error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm">
          {label}{" "}
          {required ? (
            <>
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </>
          ) : null}
        </Label>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            aria-required={required}
            className={cn(
              "h-11 w-full justify-between font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <span className="truncate">{value || "Search cities…"}</span>
            <span className="ml-2 flex shrink-0 items-center gap-1">
              {value ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear city"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearCity();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      clearCity();
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5 opacity-60" />
                </span>
              ) : null}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search cities…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No matching city.</CommandEmpty>
              <CommandGroup>
                {showLegacy ? (
                  <CommandItem value={value} onSelect={() => selectCity(value)}>
                    <Check className="mr-2 h-4 w-4 opacity-100" />
                    {value}
                    <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                  </CommandItem>
                ) : null}
                {filtered.map((city) => (
                  <CommandItem key={city} value={city} onSelect={() => selectCity(city)}>
                    <Check
                      className={cn("mr-2 h-4 w-4", value === city ? "opacity-100" : "opacity-0")}
                    />
                    {city}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!error && value && !isSupportedCity(value) ? (
        <p className="text-xs text-muted-foreground">
          This city is stored on your record. Select a supported city from the list to update it.
        </p>
      ) : null}
    </div>
  );
}

export function validateCityField(
  value: string,
  savedValue?: string,
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "City is required.";
  if (isSupportedCity(trimmed)) return undefined;
  if (savedValue && trimmed === savedValue.trim()) return undefined;
  return UNSUPPORTED_CITY_MESSAGE;
}

/** Ensures only catalog selections (or unchanged legacy) can be submitted. */
export function cityValueForSubmit(value: string, savedValue?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeSupportedCity(trimmed);
  if (normalized) return normalized;
  if (savedValue && trimmed === savedValue.trim()) return savedValue.trim();
  return null;
}

export { UNSUPPORTED_CITY_MESSAGE };
