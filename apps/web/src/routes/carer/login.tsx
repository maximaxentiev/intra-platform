import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { carerAuthApi, carerLandingPath } from "@/lib/carer";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/carer/login")({
  ssr: false,
  pendingComponent: CarerLoginPending,
  beforeLoad: async () => {
    try {
      const session = await carerAuthApi.session();
      throw redirect({ to: carerLandingPath(session), replace: true });
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      // Not signed in — show the form.
    }
  },
  component: CarerLoginPage,
});

function CarerLoginPending() {
  return (
    <CarerAuthCard title="Checking your Carer Portal access…">
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </CarerAuthCard>
  );
}

function CarerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await carerAuthApi.login(email.trim(), password);
      toast.success("Signed in");
      navigate({ to: carerLandingPath(session), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CarerAuthCard
      title="Sign in"
      description="Use the email address your coordinator invited you with."
      footer={
        <Link
          to="/carer/forgot-password"
          className="inline-flex min-h-11 items-center text-primary hover:underline"
        >
          Forgot your password?
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carer-email">Email</Label>
          <Input
            id="carer-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carer-password">Password</Label>
          <Input
            id="carer-password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </CarerAuthCard>
  );
}
