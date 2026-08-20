import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DocumentComplianceFilters } from "@/components/reports/DocumentComplianceFilters";
import {
  DocumentComplianceSummaryCards,
  DocumentComplianceSummarySkeleton,
} from "@/components/reports/DocumentComplianceSummaryCards";
import {
  DocumentReportStatusBadge,
  OverallComplianceBadge,
} from "@/components/reports/DocumentReportStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { staffApi } from "@/lib/db";
import { formatDocumentDate } from "@/lib/carer-documents";
import { formatOpsDateTimeToronto } from "@/lib/ops-report-formatters";
import { reportsApi } from "@/lib/reports-api";
import {
  CARER_DOCUMENT_CATEGORY_META,
} from "@/lib/carer-documents";
import {
  DOCUMENT_MATRIX_COLUMNS,
  documentReminderStatusLabel,
  type DocumentReportDocumentsKeys,
} from "@/lib/reports-document-labels";
import {
  isSingleStaffSelection,
  resolveAppliedStaffSelection,
  staffSelectionToApiQuery,
  staffSelectionToSearchParams,
  type StaffSelectionState,
} from "@/lib/reports-staff-selection";
import type {
  DocumentComplianceRow,
  DocumentReportDocuments,
  DocumentReportVscCategory,
  DocumentReportFirstAidCategory,
} from "@/lib/reports-types";

const searchSchema = z.object({
  staffIds: z.string().optional(),
  staffId: z.string().optional(),
  status: z.string().optional(),
  documentType: z.string().optional(),
  page: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/documents")({
  validateSearch: (search) => searchSchema.parse(search),
  component: DocumentComplianceReport,
});

function compactExpiryLabel(
  key: DocumentReportDocumentsKeys,
  doc: DocumentReportDocuments[DocumentReportDocumentsKeys],
): string | null {
  if (key === "vulnerableSectorCheck") {
    const vsc = doc as DocumentReportVscCategory;
    return vsc.expiryDate ? `Renewal due ${formatDocumentDate(vsc.expiryDate)}` : null;
  }
  if (key === "firstAidCpr") {
    const firstAid = doc as DocumentReportFirstAidCategory;
    return firstAid.expiryDate ? `Expires ${formatDocumentDate(firstAid.expiryDate)}` : null;
  }
  return null;
}

function DocumentDetailCard({
  title,
  doc,
  optional,
  showReminders,
}: {
  title: string;
  doc: DocumentReportDocuments[DocumentReportDocumentsKeys];
  optional?: boolean;
  showReminders?: boolean;
}) {
  const vsc = showReminders ? (doc as DocumentReportVscCategory) : null;
  const firstAid = showReminders ? (doc as DocumentReportFirstAidCategory) : null;
  const reminderDoc = vsc ?? firstAid;

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <DocumentReportStatusBadge status={doc.status} optional={optional} />

        {"processedDate" in doc && doc.processedDate ? (
          <p>
            <span className="text-muted-foreground">Processed date: </span>
            {formatDocumentDate(doc.processedDate)}
          </p>
        ) : null}

        {"expiryDate" in doc && doc.expiryDate ? (
          <p>
            <span className="text-muted-foreground">
              {title.includes("Vulnerable") ? "Renewal due: " : "Expiry date: "}
            </span>
            {formatDocumentDate(doc.expiryDate)}
          </p>
        ) : null}

        {doc.submittedAt ? (
          <p>
            <span className="text-muted-foreground">Submitted: </span>
            {formatOpsDateTimeToronto(doc.submittedAt)}
          </p>
        ) : null}

        {doc.reviewedAt ? (
          <p>
            <span className="text-muted-foreground">Reviewed: </span>
            {formatOpsDateTimeToronto(doc.reviewedAt)}
          </p>
        ) : null}

        {showReminders && reminderDoc ? (
          <div className="space-y-1 border-t border-border/60 pt-3">
            <p>
              <span className="text-muted-foreground">Latest reminder: </span>
              {reminderDoc.latestReminderStatus === "sent" && reminderDoc.latestReminderSentAt
                ? `Sent ${formatOpsDateTimeToronto(reminderDoc.latestReminderSentAt)}`
                : documentReminderStatusLabel(reminderDoc.latestReminderStatus)}
            </p>
            <p>
              <span className="text-muted-foreground">Next reminder: </span>
              {reminderDoc.nextReminderAt
                ? formatOpsDateTimeToronto(reminderDoc.nextReminderAt)
                : "No upcoming reminder"}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SingleStaffDocumentCards({ row }: { row: DocumentComplianceRow }) {
  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-medium">{row.staffName}</div>
            <div className="text-sm text-muted-foreground">Role: {row.role}</div>
          </div>
          <OverallComplianceBadge status={row.overallComplianceStatus} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <DocumentDetailCard
          title={CARER_DOCUMENT_CATEGORY_META.vulnerable_sector_check.title}
          doc={row.documents.vulnerableSectorCheck}
          showReminders
        />
        <DocumentDetailCard
          title={CARER_DOCUMENT_CATEGORY_META.first_aid_cpr.title}
          doc={row.documents.firstAidCpr}
          showReminders
        />
        <DocumentDetailCard
          title={CARER_DOCUMENT_CATEGORY_META.immunizations.title}
          doc={row.documents.immunizations}
        />
        <DocumentDetailCard
          title={CARER_DOCUMENT_CATEGORY_META.covid19_vaccination.title}
          doc={row.documents.covid19Vaccination}
          optional
        />
      </div>

      <div>
        <Button asChild variant="outline" size="sm">
          <Link to="/staff/$id" params={{ id: row.staffId }}>
            View Staff
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DocumentComplianceReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const appliedSelection = useMemo(() => resolveAppliedStaffSelection(search), [search]);

  const applied = useMemo(
    () => ({
      selection: appliedSelection,
      status: search.status?.trim() || "",
      documentType: search.documentType?.trim() || "",
      page: search.page && search.page > 0 ? search.page : 1,
    }),
    [search, appliedSelection],
  );

  const [selection, setSelection] = useState<StaffSelectionState>(applied.selection);
  const [status, setStatus] = useState(applied.status);
  const [documentType, setDocumentType] = useState(applied.documentType);

  const staffQ = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-documents",
      applied.selection.mode,
      applied.selection.staffIds.join(","),
      applied.status,
      applied.documentType,
      applied.page,
    ],
    queryFn: () =>
      reportsApi.documentCompliance({
        ...staffSelectionToApiQuery(applied.selection),
        status: applied.status || undefined,
        documentType: applied.documentType || undefined,
        page: applied.page,
        pageSize: 25,
      }),
  });

  const singleStaffSelected = isSingleStaffSelection(applied.selection);
  const showComparison = !singleStaffSelected;
  const summary = reportQ.data?.summary;
  const items = reportQ.data?.items ?? [];
  const reportReady = !reportQ.isLoading && summary != null;
  const emptyFiltered = reportReady && items.length === 0;

  function applyFilters(nextPage = 1) {
    navigate({
      search: {
        ...staffSelectionToSearchParams(selection),
        status: status && status !== "all" ? status : undefined,
        documentType: documentType && documentType !== "all" ? documentType : undefined,
        page: nextPage > 1 ? nextPage : undefined,
      },
    });
  }

  function resetFilters() {
    setSelection({ mode: "all", staffIds: [] });
    setStatus("");
    setDocumentType("");
    navigate({ search: {} });
  }

  function viewStaffDetails(staffId: string) {
    navigate({
      search: {
        staffIds: staffId,
        status: applied.status || undefined,
        documentType: applied.documentType || undefined,
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Compliance"
        subtitle="Review current Staff document status, expiry, and reminder delivery."
        actions={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All reports
          </Link>
        }
      />

      <DocumentComplianceFilters
        staffMembers={staffQ.data ?? []}
        selection={selection}
        status={status}
        documentType={documentType}
        onSelectionChange={setSelection}
        onStatusChange={setStatus}
        onDocumentTypeChange={setDocumentType}
        onApply={() => applyFilters(1)}
        onReset={resetFilters}
      />

      {reportQ.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load this report. Adjust filters and try again.
          </CardContent>
        </Card>
      )}

      {reportQ.isLoading ? (
        <DocumentComplianceSummarySkeleton />
      ) : (
        <DocumentComplianceSummaryCards summary={summary} loading={false} ready={reportReady} />
      )}

      {emptyFiltered && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No staff match these document filters.
          </CardContent>
        </Card>
      )}

      {singleStaffSelected && items[0] ? <SingleStaffDocumentCards row={items[0]} /> : null}

      {reportQ.isLoading && showComparison && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {!reportQ.isLoading && showComparison && items.length > 0 && (
        <>
          <div className="hidden lg:block">
            <Card className="border-border/70 shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Overall</TableHead>
                    {DOCUMENT_MATRIX_COLUMNS.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.staffId}>
                      <TableCell>
                        <div className="font-medium">{row.staffName}</div>
                        <div className="text-xs text-muted-foreground">{row.role}</div>
                      </TableCell>
                      <TableCell>
                        <OverallComplianceBadge status={row.overallComplianceStatus} />
                      </TableCell>
                      {DOCUMENT_MATRIX_COLUMNS.map((column) => {
                        const doc = row.documents[column.key];
                        const expiry = compactExpiryLabel(column.key, doc);
                        return (
                          <TableCell key={column.key}>
                            <div className="space-y-1">
                              <DocumentReportStatusBadge
                                status={doc.status}
                                optional={
                                  column.key === "covid19Vaccination" ? true : undefined
                                }
                              />
                              {expiry ? (
                                <div className="text-xs text-muted-foreground">{expiry}</div>
                              ) : null}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => viewStaffDetails(row.staffId)}
                        >
                          View details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((row) => (
              <Card key={row.staffId} className="border-border/70 shadow-xs">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{row.staffName}</div>
                      <div className="text-sm text-muted-foreground">Role: {row.role}</div>
                    </div>
                    <OverallComplianceBadge status={row.overallComplianceStatus} />
                  </div>
                  <div className="space-y-2 text-sm">
                    {DOCUMENT_MATRIX_COLUMNS.map((column) => {
                      const doc = row.documents[column.key];
                      return (
                        <div key={column.key} className="flex flex-wrap items-center gap-2">
                          <span className="min-w-24 text-muted-foreground">{column.label}</span>
                          <DocumentReportStatusBadge
                            status={doc.status}
                            optional={
                              column.key === "covid19Vaccination" ? true : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => viewStaffDetails(row.staffId)}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {reportQ.data && reportQ.data.totalCount > reportQ.data.pageSize && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {reportQ.data.page} · {reportQ.data.totalCount} staff
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={applied.page <= 1}
                  onClick={() => applyFilters(applied.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!reportQ.data.hasMore}
                  onClick={() => applyFilters(applied.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
