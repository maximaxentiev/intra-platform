import { createFileRoute, redirect } from "@tanstack/react-router";
import { Building2, UserRound } from "lucide-react";
import { AuthRoleOptionCard } from "@/components/auth/AuthRoleOptionCard";
import { IntraAuthLogo } from "@/components/auth/IntraAuthLogo";
import { isCarerPortalEnabled } from "@/lib/carer-portal-flag";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (!isCarerPortalEnabled()) {
      throw redirect({ to: "/auth", replace: true });
    }
  },
  head: () => ({
    meta: [
      { title: "Intra — Sign in" },
      {
        name: "description",
        content:
          "Sign in to the Intra Platform for operations teams and independent carers.",
      },
      { property: "og:title", content: "Intra — Sign in" },
      {
        property: "og:description",
        content:
          "Sign in to the Intra Platform for operations teams and independent carers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoleChoicePage,
});

const OPTIONS = [
  {
    to: "/auth" as const,
    icon: Building2,
    title: "Intra Operations Team",
    description: "Manage centres, carers, shifts, and applications.",
  },
  {
    to: "/carer/login" as const,
    icon: UserRound,
    title: "Independent Carer",
    description: "View your shifts, availability, and documents.",
  },
];

function RoleChoicePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <IntraAuthLogo size="lg" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome to the Intra Platform
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how you would like to sign in.
          </p>
        </div>

        <div className="grid gap-5">
          {OPTIONS.filter((option) => option.to === "/auth" || isCarerPortalEnabled()).map(
            (option) => (
              <AuthRoleOptionCard
                key={option.to}
                to={option.to}
                icon={option.icon}
                title={option.title}
                description={option.description}
              />
            ),
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Accounts are invite-only. Contact your Intra coordinator if you need access.
        </p>
      </div>
    </div>
  );
}
