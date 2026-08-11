import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { carerAuthApi, carerLandingPath, passwordProblem, type CarerInviteInfo } from "@/lib/carer";
import { resolveUnusableInviteRedirect } from "@/lib/carer-invite-routing";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/carer/invite/$token")({
  ssr: false,
  pendingComponent: InviteAccessPending,
  beforeLoad: async ({ params }) => {
    try {
      const invite = await carerAuthApi.invite(params.token);
      return { invite };
    } catch {
      const destination = await resolveUnusableInviteRedirect({
        getSession: () => carerAuthApi.session(),
        landingPath: carerLandingPath,
      });
      throw redirect({ to: destination, replace: true });
    }
  },
  loader: ({ context }) => context.invite as CarerInviteInfo,
  component: CarerInvitePage,
});

function InviteAccessPending() {
  return (
    <CarerAuthCard title="Checking your Carer Portal access…">
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </CarerAuthCard>
  );
}

function CarerInvitePage() {
  const invite = Route.useLoaderData();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const session = await carerAuthApi.acceptInvite(token, password);
      toast.success("Password set — welcome to Intra");
      navigate({ to: carerLandingPath(session), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set your password");
    } finally {
      setLoading(false);
    }
  }

  const name = [invite.legalFirstName, invite.legalLastName].filter(Boolean).join(" ");

  return (
    <CarerAuthCard
      title={invite.alreadySetUp ? "Set a new password" : "Create your password"}
      description={
        <>
          {name ? `${name} — ` : null}
          {invite.email}
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carer-new-password">New password</Label>
          <Input
            id="carer-new-password"
            type="password"
            autoComplete="new-password"
            required
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            At least 12 characters, with an uppercase letter, a lowercase letter, and a number.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="carer-confirm-password">Confirm password</Label>
          <Input
            id="carer-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className="h-11"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </CarerAuthCard>
  );
}
