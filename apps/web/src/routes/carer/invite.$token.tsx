import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { carerAuthApi, carerLandingPath, passwordProblem } from "@/lib/carer";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { CarerInviteUnavailable } from "@/components/carer/CarerInviteUnavailable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/carer/invite/$token")({
  ssr: false,
  component: CarerInvitePage,
});

function CarerInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const invite = useQuery({
    queryKey: ["carer-invite", token],
    queryFn: () => carerAuthApi.invite(token),
    retry: false,
  });

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

  if (invite.isLoading) {
    return (
      <CarerAuthCard title="Checking your link…">
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </CarerAuthCard>
    );
  }

  if (invite.isError || !invite.data) {
    return <CarerInviteUnavailable />;
  }

  const name = [invite.data.legalFirstName, invite.data.legalLastName].filter(Boolean).join(" ");

  return (
    <CarerAuthCard
      title={invite.data.alreadySetUp ? "Set a new password" : "Create your password"}
      description={
        <>
          {name ? `${name} — ` : null}
          {invite.data.email}
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
