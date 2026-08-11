import { Link } from "@tanstack/react-router";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { Button } from "@/components/ui/button";

/** Generic unavailable invite state — no token or account enumeration. */
export function CarerInviteUnavailable() {
  return (
    <CarerAuthCard title="This invitation link is no longer available">
      <p className="text-sm text-muted-foreground">
        If you&apos;ve already created your account, sign in to the Carer Portal. If you still need
        to create your account, contact Intra for a new invitation.
      </p>
      <Button asChild className="mt-4 h-11 w-full">
        <Link to="/carer/login">Go to Carer Login</Link>
      </Button>
    </CarerAuthCard>
  );
}
