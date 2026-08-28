import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CarerBackButton } from "@/components/carer/CarerBackButton";
import { CarerShell } from "@/components/carer/CarerShell";
import { CarerDocumentsForm } from "@/components/carer/CarerDocumentsForm";
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
    <CarerShell session={carer} title="Documents">
      <div className="mb-4">
        <CarerBackButton to="/carer" label="Back to portal" />
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
