import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { carerAuthApi } from "@/lib/carer";
import { CarerAuthCard } from "@/components/carer/CarerAuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/carer/forgot-password")({
  ssr: false,
  component: CarerForgotPasswordPage,
});

function CarerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await carerAuthApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <CarerAuthCard
        title="Check your email"
        description="If an account exists for that address, we've sent a link to set a new password. The link expires in 24 hours."
      >
        <p className="text-sm text-muted-foreground">
          Didn't get it? Check your spam folder, or contact your Intra coordinator.
        </p>
      </CarerAuthCard>
    );
  }

  return (
    <CarerAuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new password."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="carer-reset-email">Email</Label>
          <Input
            id="carer-reset-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </CarerAuthCard>
  );
}
