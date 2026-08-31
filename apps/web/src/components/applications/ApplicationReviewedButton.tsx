import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ApplicationReviewedButton({
  reviewed,
  pending,
  onReview,
}: {
  reviewed: boolean;
  pending: boolean;
  onReview: () => void;
}) {
  if (reviewed) {
    return (
      <span className="text-xs font-medium text-success whitespace-nowrap">Reviewed</span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-7 px-2 text-xs whitespace-nowrap")}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onReview();
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
      Reviewed
    </Button>
  );
}
