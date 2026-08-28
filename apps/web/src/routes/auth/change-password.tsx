import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/db";
import { requiresForcedPasswordChange } from "@/lib/ops-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/change-password")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await authApi.session();
      if (!requiresForcedPasswordChange(user)) {
        throw redirect({ to: "/dashboard", replace: true });
      }
      return { user };
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/auth", replace: true });
    }
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmError(null);

    if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const user = await authApi.replacePassword(newPassword);
      queryClient.setQueryData(["auth", "session"], user);
      toast.success("Password updated");
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    await queryClient.resetQueries({ queryKey: ["auth", "session"] });
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
            IN
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Intra Platform</h1>
        </div>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg">Create a new password</CardTitle>
            <CardDescription>
              Your temporary password must be replaced before you can continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={12}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {confirmError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {confirmError}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Changing password…" : "Change password"}
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full text-muted-foreground"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
