import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { carerAuthApi, passwordProblem } from "@/lib/carer";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/carer/reset-password/$token")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    try {
      await carerAuthApi.validateResetPassword(params.token);
      return { resetValid: true as const };
    } catch {
      return { resetValid: false as const };
    }
  },
  loader: ({ context }) => ({ valid: context.resetValid }),
  component: CarerResetPasswordPage,
});

function CarerResetPasswordPage() {
  const { token } = Route.useParams();
  const { valid } = Route.useLoaderData();

  if (!valid) {
    return (
      <CarerAuthCard
        title="Reset link unavailable"
        description="This password reset link is invalid or has expired."
        footer={
          <Link
            to="/carer/forgot-password"
            className="inline-flex min-h-11 items-center text-primary hover:underline"
          >
            Request a new reset link
          </Link>
        }
      />
    );
  }

  return <CarerResetPasswordForm token={token} />;
}

function CarerResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

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
      await carerAuthApi.resetPassword(token, password);
      setCompleted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset your password");
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <CarerAuthCard
        title="Password updated"
        description="Your password has been reset. Sign in with your new password."
        footer={
          <Link
            to="/carer/login"
            className="inline-flex min-h-11 items-center text-primary hover:underline"
          >
            Back to sign in
          </Link>
        }
      />
    );
  }

  return (
    <CarerAuthCard
      title="Choose a new password"
      description="Enter and confirm your new password. This link expires in 60 minutes."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carer-reset-new-password">New password</Label>
          <Input
            id="carer-reset-new-password"
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
          <Label htmlFor="carer-reset-confirm-password">Confirm password</Label>
          <Input
            id="carer-reset-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className="h-11"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </CarerAuthCard>
  );
}
