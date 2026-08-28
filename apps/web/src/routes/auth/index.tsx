import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/db";
import { opsLoginDestination, resolveOpsPostLoginNavigation } from "@/lib/ops-auth";
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
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground text-base font-bold shadow-sm">
            IN
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Intra Platform</h1>
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
