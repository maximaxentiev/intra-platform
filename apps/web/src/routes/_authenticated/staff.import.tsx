import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  staffApi,
  type StaffCsvImportResult,
  type StaffCsvPreviewResult,
  type StaffCsvPreviewRow,
  type StaffCsvImportRowResult,
} from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Mail,
  FileText,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/import")({
  component: StaffImportPage,
});

type Filter = "all" | "valid" | "invalid" | "duplicate";

const REQUIRED_COLUMNS = [
  "Display Name",
  "Legal First Name",
  "Legal Last Name",
  "Role",
  "Email Address",
  "Phone Number",
  "Home Address",
  "City",
];

function StaffImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StaffCsvPreviewResult | null>(null);
  const [results, setResults] = useState<StaffCsvImportResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendInvites, setSendInvites] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter((row) => {
      if (filter === "all") return true;
      if (filter === "valid") return row.status === "valid";
      if (filter === "invalid") return row.status === "invalid";
      return row.status === "duplicate";
    });
  }, [preview, filter]);

  function resetFile() {
    setResults(null);
    setPreview(null);
    setFile(null);
    setErrorMessage(null);
    setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFileChange(f: File | null) {
    setResults(null);
    setPreview(null);
    setErrorMessage(null);
    setFilter("all");
    setFile(f);
    if (!f) return;
    setLoading(true);
    try {
      const data = await staffApi.previewCsvImport(f);
      setPreview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview failed";
      setErrorMessage(message);
      toast.error(message);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    if (!file || !preview?.summary.valid) return;
    setConfirmOpen(false);
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await staffApi.confirmCsvImport(file, sendInvites);
      setResults(data);
      const hasFailures =
        data.summary.failed > 0 || data.summary.invitationEmailFailures > 0;
      if (hasFailures) {
        toast.warning("Import finished with issues — review the results below");
      } else {
        toast.success("Import finished");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const maxRows = preview?.limits.maxRows ?? 500;
  const maxKb = preview ? Math.round(preview.limits.maxBytes / 1024) : 512;

  return (
    <div className="space-y-6 max-w-5xl overflow-x-hidden">
      <PageHeader
        eyebrow="Staff"
        backTo="/staff"
        backLabel="Back to Staff"
        title="Import staff"
        subtitle="Upload a CSV to preview rows before creating staff records. Nothing is saved until you confirm."
      />

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Upload CSV file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Required columns
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_COLUMNS.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Limits: up to {maxRows} rows, {maxKb} KB max file size. Uploading only builds a
              preview — nothing is imported until you confirm.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border/70 bg-surface-muted/40 p-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              disabled={loading}
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 break-all font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  disabled={loading}
                  onClick={resetFile}
                >
                  <X className="h-3.5 w-3.5 mr-1" aria-hidden /> Remove
                </Button>
              </div>
            ) : null}
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {loading && !preview && !results ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Processing…
        </div>
      ) : null}

      {preview && !results ? (
        <>
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2. Preview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total rows" value={preview.summary.total} hint="in this file" />
              <Metric
                label="Valid"
                value={preview.summary.valid}
                hint="will be imported"
                tone="success"
              />
              <Metric
                label="Invalid"
                value={preview.summary.invalid}
                hint="need attention"
                tone="destructive"
              />
              <Metric
                label="Duplicate"
                value={preview.summary.duplicate}
                hint="already exist"
                tone="warning"
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            {(["all", "valid", "invalid", "duplicate"] as Filter[]).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 opacity-70">
                  {f === "all"
                    ? preview.summary.total
                    : f === "valid"
                      ? preview.summary.valid
                      : f === "invalid"
                        ? preview.summary.invalid
                        : preview.summary.duplicate}
                </span>
              </Button>
            ))}
          </div>

          <div className="rounded-lg border border-border/70 overflow-x-auto max-w-full">
            <table className="w-full table-fixed sm:table-auto text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-2 font-medium w-12">Row</th>
                  <th className="p-2 font-medium min-w-0">Name</th>
                  <th className="p-2 font-medium w-16">Role</th>
                  <th className="p-2 font-medium min-w-0">Email</th>
                  <th className="p-2 font-medium min-w-0">Phone</th>
                  <th className="p-2 font-medium w-28">Status</th>
                  <th className="p-2 font-medium min-w-0">Issues</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <PreviewRow key={row.rowNumber} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3. Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 rounded-lg border border-border/70 p-3 space-y-2">
                  <p className="text-sm font-medium">Import staff only</p>
                  <p className="text-xs text-muted-foreground">
                    Creates staff records. No emails are sent.
                  </p>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={preview.summary.valid === 0 || loading}
                    onClick={() => {
                      setSendInvites(false);
                      setConfirmOpen(true);
                    }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden />
                    ) : null}
                    Import staff only
                  </Button>
                </div>
                <div className="flex-1 rounded-lg border border-border/70 p-3 space-y-2">
                  <p className="text-sm font-medium">Import and send portal invitations</p>
                  <p className="text-xs text-muted-foreground">
                    Creates staff records and emails a portal invitation to every imported staff
                    member.
                  </p>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    disabled={preview.summary.valid === 0 || loading}
                    onClick={() => {
                      setSendInvites(true);
                      setConfirmOpen(true);
                    }}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden />
                    ) : (
                      <Mail className="h-4 w-4 mr-1.5" aria-hidden />
                    )}
                    Import and send portal invitations
                  </Button>
                </div>
              </div>
              {preview.summary.valid === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No valid rows to import. Fix the issues above and upload the file again.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {results ? (
        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Import results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm min-w-0">
            <ResultBanner results={results} />
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Processed" value={results.summary.totalProcessed} />
              <Metric label="Created" value={results.summary.staffCreated} tone="success" />
              <Metric label="Skipped" value={results.summary.skipped} />
              <Metric label="Duplicates" value={results.summary.duplicates} tone="warning" />
              <Metric
                label="Failed"
                value={results.summary.failed}
                tone={results.summary.failed > 0 ? "destructive" : undefined}
              />
              <Metric label="Invites sent" value={results.summary.invitationsSent} />
              <Metric
                label="Invite email failures"
                value={results.summary.invitationEmailFailures}
                tone={results.summary.invitationEmailFailures > 0 ? "destructive" : undefined}
              />
            </dl>
            <div className="hidden md:block rounded-lg border border-border/70 overflow-x-auto max-w-full max-h-80 overflow-y-auto">
              <table className="w-full table-fixed md:table-auto text-sm">
                <thead className="bg-muted/50 text-left sticky top-0 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-2 w-12">
                      Row
                    </th>
                    <th scope="col" className="p-2 min-w-0">
                      Email
                    </th>
                    <th scope="col" className="p-2 min-w-0">
                      Phone
                    </th>
                    <th scope="col" className="p-2 w-28">
                      Outcome
                    </th>
                    <th scope="col" className="p-2 min-w-0">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row) => (
                    <ImportResultRow key={`${row.rowNumber}-${row.email}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-2 max-h-80 overflow-y-auto">
              {results.rows.map((row) => (
                <li
                  key={`${row.rowNumber}-${row.email}-mobile`}
                  className="rounded-lg border border-border/70 p-3 text-sm space-y-1 min-w-0"
                >
                  <div className="font-medium tabular-nums">Row {row.rowNumber}</div>
                  <div className="break-all">
                    <span className="text-muted-foreground">Email: </span>
                    {row.email}
                  </div>
                  <div className="break-all whitespace-normal">
                    <span className="text-muted-foreground">Phone: </span>
                    {row.phone || "—"}
                  </div>
                  <div className="capitalize">
                    <span className="text-muted-foreground">Outcome: </span>
                    {row.outcome.replace(/_/g, " ")}
                  </div>
                  {row.message ? (
                    <div className="text-muted-foreground break-words">
                      <span className="text-foreground/80">Notes: </span>
                      {row.message}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <Link to="/staff">Return to staff list</Link>
              </Button>
              <Button type="button" variant="ghost" onClick={resetFile}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm staff import</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will create <strong>{preview?.summary.valid ?? 0}</strong> staff record
                  {(preview?.summary.valid ?? 0) === 1 ? "" : "s"}.
                </p>
                <p>
                  {(preview?.summary.invalid ?? 0) + (preview?.summary.duplicate ?? 0)} row
                  {(preview?.summary.invalid ?? 0) + (preview?.summary.duplicate ?? 0) === 1
                    ? ""
                    : "s"}{" "}
                  will be skipped (invalid or duplicate).
                </p>
                <p>
                  Portal invitations:{" "}
                  <strong>{sendInvites ? "will be sent for each imported staff member" : "will not be sent"}</strong>.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runImport()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden /> : null}
              Confirm import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResultBanner({ results }: { results: StaffCsvImportResult }) {
  const hasFailures =
    results.summary.failed > 0 || results.summary.invitationEmailFailures > 0;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3",
        hasFailures
          ? "border-warning/25 bg-warning-soft text-warning"
          : "border-success/25 bg-success-soft text-success",
      )}
    >
      {hasFailures ? (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 break-words">
        {hasFailures
          ? `Import completed with issues: ${results.summary.failed} failed row${
              results.summary.failed === 1 ? "" : "s"
            } and ${results.summary.invitationEmailFailures} invitation email failure${
              results.summary.invitationEmailFailures === 1 ? "" : "s"
            }. Review the rows below.`
          : `Import completed successfully. ${results.summary.staffCreated} staff record${
              results.summary.staffCreated === 1 ? "" : "s"
            } created.`}
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "success" | "destructive" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/70 bg-surface-muted/40 p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("font-semibold text-2xl tabular-nums", toneCls)}>{value}</dd>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ImportResultRow({ row }: { row: StaffCsvImportRowResult }) {
  return (
    <tr className="border-t border-border/60">
      <td className="p-2 tabular-nums">{row.rowNumber}</td>
      <td className="p-2 break-all">{row.email}</td>
      <td className="p-2 break-all whitespace-normal">{row.phone || "—"}</td>
      <td className="p-2 capitalize">{row.outcome.replace(/_/g, " ")}</td>
      <td className="p-2 text-muted-foreground break-words">{row.message ?? "—"}</td>
    </tr>
  );
}

function PreviewRow({ row }: { row: StaffCsvPreviewRow }) {
  const variant =
    row.status === "valid" ? "default" : row.status === "duplicate" ? "secondary" : "destructive";
  const Icon =
    row.status === "valid" ? CheckCircle2 : row.status === "duplicate" ? Copy : AlertCircle;
  return (
    <tr
      className={cn(
        "border-t border-border/60 border-l-2",
        row.status === "valid"
          ? "border-l-transparent"
          : row.status === "duplicate"
            ? "border-l-warning bg-warning-soft/30"
            : "border-l-destructive bg-destructive/5",
      )}
    >
      <td className="p-2 tabular-nums">{row.rowNumber}</td>
      <td className="p-2 min-w-0 break-words">{row.displayName || "—"}</td>
      <td className="p-2">{row.role || "—"}</td>
      <td className="p-2 min-w-0 break-all">{row.email || "—"}</td>
      <td className="p-2 min-w-0 break-all whitespace-normal">{row.phone || "—"}</td>
      <td className="p-2">
        <Badge variant={variant} className="gap-1 capitalize">
          <Icon className="h-3 w-3" aria-hidden />
          {row.status}
        </Badge>
      </td>
      <td className="p-2 text-muted-foreground break-words">{row.issues.join(" ") || "—"}</td>
    </tr>
  );
}
