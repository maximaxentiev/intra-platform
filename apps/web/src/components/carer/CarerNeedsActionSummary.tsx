import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { CarerSession } from "@/lib/carer";
import { carerDocumentsApi } from "@/lib/carer-documents";
import { buildCarerNeedsActionItems } from "@/lib/carer-needs-action";
import { onboardingComplete } from "@/lib/carer-onboarding";

type CarerNeedsActionSummaryProps = {
  session: CarerSession;
};

export function CarerNeedsActionSummary({ session }: CarerNeedsActionSummaryProps) {
  const needsDocuments = onboardingComplete(session);

  const documents = useQuery({
    queryKey: ["carer-documents"],
    queryFn: () => carerDocumentsApi.get(),
    enabled: needsDocuments,
  });

  const items = buildCarerNeedsActionItems(session, documents.data);

  if (needsDocuments && documents.isLoading) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="carer-needs-action-heading" className="space-y-2">
      <h2 id="carer-needs-action-heading" className="text-base font-semibold text-foreground">
        Needs action
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.href}
              className="group flex min-h-12 items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2.5 text-sm transition-colors hover:border-warning/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className="min-w-0 flex-1 font-medium text-foreground">{item.label}</span>
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
      {needsDocuments && documents.isFetching && !documents.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
          Refreshing…
        </p>
      ) : null}
    </section>
  );
}
