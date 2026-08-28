import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/db";
import { opsLoginDestination, resolveOpsPostLoginNavigation } from "@/lib/ops-auth";
import { IntraAuthLogo } from "@/components/auth/IntraAuthLogo";
import { isCarerPortalEnabled } from "@/lib/carer-portal-flag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/")({
  beforeLoad: async () => {
    try {
      const user = await authApi.session();
      throw redirect({ to: opsLoginDestination(user), replace: true });
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await authApi.login(email, password);
      queryClient.setQueryData(["auth", "session"], user);
      const navigation = resolveOpsPostLoginNavigation(user);
      await navigate(navigation);
      toast.success(
        user.mustChangePassword ? "Signed in — create your new password" : "Signed in",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <IntraAuthLogo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            Intra Operations Team
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to the Intra Platform</p>
        </div>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>
              Access is invite-only. Contact an administrator if you need an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input
                  id="si-email"
                  type="email"
                  required
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-pass">Password</Label>
                <Input
                  id="si-pass"
                  type="password"
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
          </CardContent>
        </Card>
        {isCarerPortalEnabled() ? (
          <p className="mt-6 text-center text-sm">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Back to sign-in options
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
