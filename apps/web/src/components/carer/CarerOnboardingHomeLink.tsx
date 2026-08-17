import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARER_ONBOARDING_HUB_PATH } from "@/lib/carer-onboarding-hub";

/** Secondary navigation back to the onboarding hub from any step page. */
export function CarerOnboardingHomeLink() {
  return (
    <Button
      asChild
      variant="ghost"
      className="mb-4 h-11 min-h-11 px-0 text-muted-foreground hover:text-foreground"
    >
      <Link to={CARER_ONBOARDING_HUB_PATH}>
        <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
        Onboarding home
      </Link>
    </Button>
  );
}
