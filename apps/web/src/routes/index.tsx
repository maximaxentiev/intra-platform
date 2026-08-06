import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, UserRound } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intra — Sign in" },
      {
        name: "description",
        content:
          "Sign in to Intra, the operations platform for childcare centres, ops teams, and independent carers.",
      },
      { property: "og:title", content: "Intra — Sign in" },
      {
        property: "og:description",
        content:
          "Sign in to Intra, the operations platform for childcare centres, ops teams, and independent carers.",
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
    title: "Ops Team",
    description: "Manage centres, carers, shifts, and applications.",
    tone: "bg-secondary",
  },
  {
    to: "/carer/login" as const,
    icon: UserRound,
    title: "Independent Carer",
    description: "View your shifts, availability, and documents.",
    tone: "bg-secondary",
  },
];

function RoleChoicePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
            IN
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome to Intra
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose how you would like to sign in.
          </p>
        </div>

        <div className="grid gap-4">
          {OPTIONS.map((option) => (
            <Link
              key={option.to}
              to={option.to}
              className="group flex min-h-[92px] items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-foreground ${option.tone}`}
              >
                <option.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">{option.title}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{option.description}</div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Accounts are invite-only. Contact your Intra coordinator if you need access.
        </p>
      </div>
    </div>
  );
}
