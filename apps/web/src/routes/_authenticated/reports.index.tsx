import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Building2, ClipboardList, FileText, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsLanding,
});

const REPORT_CARDS = [
  {
    title: "Shift Fulfillment",
    description: "Track how many shifts were filled, completed, pending, or cancelled.",
    to: "/reports/shift-fulfillment",
    icon: BarChart3,
    available: true,
  },
  {
    title: "Centre Usage",
    description: "Review shift volume and scheduled staffing hours by Centre.",
    to: "/reports/centre-usage",
    icon: Building2,
    available: true,
  },
  {
    title: "Staff Usage",
    description: "Review completed and upcoming shift usage by Staff member.",
    to: "/reports/staff-usage",
    icon: Users,
    available: true,
  },
  {
    title: "Document Compliance",
    description: "Coming soon",
    icon: FileText,
    available: false,
  },
  {
    title: "Activity Log",
    description: "Coming soon",
    icon: ClipboardList,
    available: false,
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
          const Icon = card.icon;
          const body = (
            <Card
              className={`h-full border-border/70 shadow-xs ${
                card.available
                  ? "transition-colors hover:border-primary/40 hover:shadow-sm"
                  : "opacity-70"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {card.title}
                </CardTitle>
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
