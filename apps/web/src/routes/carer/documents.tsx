import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerDocumentsForm } from "@/components/carer/CarerDocumentsForm";
import { Button } from "@/components/ui/button";
import { carerDocumentsApi } from "@/lib/carer-documents";
import { requireCarerSessionForPortal } from "@/lib/carer-route-guards";

export const Route = createFileRoute("/carer/documents")({
  ssr: false,
  beforeLoad: async () => {
    const carer = await requireCarerSessionForPortal();
    return { carer };
  },
  component: CarerAccountDocumentsPage,
});

function CarerAccountDocumentsPage() {
  const { carer } = Route.useRouteContext();

  const documents = useQuery({
    queryKey: ["carer-documents"],
    queryFn: () => carerDocumentsApi.get(),
  });

  return (
    <CarerShell
      session={carer}
      title="Documents"
      subtitle="Upload and manage the documents Intra needs for compliance review."
    >
      <div className="mb-4">
        <Button asChild variant="ghost" className="h-10 px-0 text-muted-foreground hover:text-foreground">
          <Link to="/carer">
            <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Back to portal
          </Link>
        </Button>
      </div>
      <CarerDocumentsForm
        mode="account"
        documents={documents.data}
        isLoading={documents.isLoading}
        step2Complete={Boolean(documents.data?.documentsCompletedAt)}
        onRefresh={() => documents.refetch()}
      />
    </CarerShell>
  );
}
