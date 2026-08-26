import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function hasChildcareExperienceDescription(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

export function childcareExperiencePreviewLabel(value: string | undefined | null): string {
  return hasChildcareExperienceDescription(value) ? value!.trim() : "Not provided";
}

export function ChildcareExperiencePreview({
  description,
  onOpen,
  className,
}: {
  description?: string | null;
  onOpen?: () => void;
  className?: string;
}) {
  const text = description?.trim() ?? "";
  if (!text) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)} aria-label="Childcare experience not provided">
        Not provided
      </span>
    );
  }

  const ariaPreview = text.length > 120 ? `${text.slice(0, 120)}…` : text;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          className={cn(
            "block w-full max-w-[16rem] text-left text-sm outline-none",
            "rounded-sm focus-visible:ring-2 focus-visible:ring-ring",
            "hover:text-foreground/90",
            className,
          )}
          aria-label={`Childcare experience: ${ariaPreview}. Open full application.`}
        >
          <span className="line-clamp-2 break-words">{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="z-50 max-w-[min(calc(100vw-2rem),28rem)] max-h-64 overflow-y-auto whitespace-pre-wrap break-words border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
