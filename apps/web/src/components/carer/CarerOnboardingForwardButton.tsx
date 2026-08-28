import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ONBOARDING_SAVING_CHANGES_LABEL } from "@/lib/carer-onboarding-save-state";
import { cn } from "@/lib/utils";

type CarerOnboardingForwardButtonProps = {
  label: string;
  saving: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
  onClick?: () => void;
  className?: string;
};

/** Primary forward/completion action for onboarding steps. */
export function CarerOnboardingForwardButton({
  label,
  saving,
  disabled = false,
  type = "button",
  form,
  onClick,
  className,
}: CarerOnboardingForwardButtonProps) {
  return (
    <Button
      type={type}
      form={form}
      disabled={disabled || saving}
      onClick={onClick}
      className={cn("h-12 min-w-[14rem] px-6 text-base font-semibold", className)}
    >
      {saving ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {ONBOARDING_SAVING_CHANGES_LABEL}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
