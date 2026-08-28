import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { IntraAuthLogo } from "@/components/auth/IntraAuthLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shared shell for the carer-facing auth screens (login, invite, reset). */
export function CarerAuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <IntraAuthLogo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Carer Portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your shifts, availability, and documents.
          </p>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? (
              <CardDescription className="leading-relaxed">{description}</CardDescription>
            ) : null}
          </CardHeader>
          {children ? <CardContent>{children}</CardContent> : null}
        </Card>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          {footer}
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign-in options
          </Link>
        </div>
      </div>
    </div>
  );
}
