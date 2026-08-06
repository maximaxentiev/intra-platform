import { Link } from "@tanstack/react-router";

/** Shown for all /carer/* routes when VITE_CARER_PORTAL_ENABLED is false. */
export function CarerPortalUnavailable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Independent Carer portal</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Independent Carer portal access is not currently available. If you received an invitation
          email, your link will work once the portal is enabled for your organization.
        </p>
        <p className="text-sm text-muted-foreground">
          Operations team members can{" "}
          <Link to="/auth" className="text-primary font-medium underline-offset-4 hover:underline">
            sign in to the ops portal
          </Link>{" "}
          separately — opening this page does not sign you in.
        </p>
      </div>
    </div>
  );
}
