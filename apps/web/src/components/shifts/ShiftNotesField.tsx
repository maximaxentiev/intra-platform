import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SHIFT_NOTES_MAX_LENGTH } from "@/lib/batch-shift-ui";

export const SHIFT_NOTES_HELPER =
  "Optional notes specific to this Shift. These will be included in Shift confirmation communications.";

export function ShiftNotesField({
  id,
  value,
  onChange,
  disabled,
  error,
  compact,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Shift Notes</Label>
      {!compact && (
        <p className="text-xs text-muted-foreground">{SHIFT_NOTES_HELPER}</p>
      )}
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        maxLength={SHIFT_NOTES_MAX_LENGTH}
        rows={compact ? 2 : 3}
        placeholder="Optional"
        className="resize-y min-h-[4.5rem]"
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
