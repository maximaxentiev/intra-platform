import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HelpSearchInput({
  value,
  onChange,
  id = "help-search",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="relative">
      <Label htmlFor={id} className="sr-only">
        Search Help
      </Label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search Help (e.g. assign, cancel batch, VSC)"
        className="h-11 pl-9"
        autoComplete="off"
      />
    </div>
  );
}
