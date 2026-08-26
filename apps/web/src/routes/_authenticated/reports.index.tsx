import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsLanding,
});

const REPORT_CARDS = [
  {
    title: "Centre & Shift Performance",
    description: "Review fill performance, shift volume, and scheduled staffing hours by centre.",
    to: "/reports/centre-usage",
    available: true,
  },
  {
    title: "Staff Usage",
    description: "Review completed and upcoming shift usage by Staff member.",
    to: "/reports/staff-usage",
    available: true,
  },
  {
    title: "Document Compliance",
    description: "Review current Staff document status, expiry, and reminder delivery.",
    to: "/reports/documents",
    available: true,
  },
  {
    title: "Activity Log",
    description: "Review recorded Staff, Shift, document, communication, and administrative activity.",
    to: "/reports/activity",
    available: true,
  },
] as const;

function ReportsLanding() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Operational reporting for shift staffing and compliance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_CARDS.map((card) => {
          const body = (
            <Card
              className={`h-full border-border/70 shadow-xs ${
                card.available
                  ? "transition-colors hover:border-primary/40 hover:shadow-sm"
                  : "opacity-70"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {card.available ? (
                  <span className="text-sm font-medium text-primary">Open report</span>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">Coming soon</span>
                )}
              </CardContent>
            </Card>
          );

          if (!card.available) {
            return (
              <div key={card.title} aria-disabled="true">
                {body}
              </div>
            );
          }

          return (
            <Link key={card.title} to={card.to} className="block h-full">
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
