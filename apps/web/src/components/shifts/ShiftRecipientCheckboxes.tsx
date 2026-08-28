import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type ShiftRecipientAvailability = {
  available: boolean;
  reason?: string;
};

type Props = {
  centreAvailability: ShiftRecipientAvailability;
  carerAvailability: ShiftRecipientAvailability;
  centreSelected: boolean;
  carerSelected: boolean;
  onCentreSelectedChange: (selected: boolean) => void;
  onCarerSelectedChange: (selected: boolean) => void;
  disabled?: boolean;
};

export function ShiftRecipientCheckboxes({
  centreAvailability,
  carerAvailability,
  centreSelected,
  carerSelected,
  onCentreSelectedChange,
  onCarerSelectedChange,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Choose recipients</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={centreSelected}
            disabled={disabled || !centreAvailability.available}
            onCheckedChange={(checked) => onCentreSelectedChange(checked === true)}
          />
          <span>
            <span className="font-medium">Centre</span>
            {!centreAvailability.available && (
              <span className="block text-muted-foreground">
                {centreAvailability.reason ?? "No valid Centre email configured."}
              </span>
            )}
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={carerSelected}
            disabled={disabled || !carerAvailability.available}
            onCheckedChange={(checked) => onCarerSelectedChange(checked === true)}
          />
          <span>
            <span className="font-medium">Carer</span>
            {!carerAvailability.available && (
              <span className="block text-muted-foreground">
                {carerAvailability.reason ?? "No Carer assigned."}
              </span>
            )}
          </span>
        </label>
      </div>
    </div>
  );
}

export function hasSelectedRecipient(centreSelected: boolean, carerSelected: boolean): boolean {
  return centreSelected || carerSelected;
}
