import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  staffApi,
  type StaffCsvImportResult,
  type StaffCsvPreviewResult,
  type StaffCsvPreviewRow,
} from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/import")({
  component: StaffImportPage,
});

type Filter = "all" | "valid" | "invalid" | "duplicate";

function StaffImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StaffCsvPreviewResult | null>(null);
  const [results, setResults] = useState<StaffCsvImportResult | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendInvites, setSendInvites] = useState(false);

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter((row) => {
      if (filter === "all") return true;
      if (filter === "valid") return row.status === "valid";
      if (filter === "invalid") return row.status === "invalid";
      return row.status === "duplicate";
    });
  }, [preview, filter]);

  async function onFileChange(f: File | null) {
    setResults(null);
    setPreview(null);
    setFile(f);
    if (!f) return;
    setLoading(true);
    try {
      const data = await staffApi.previewCsvImport(f);
      setPreview(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
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
    try {
      const data = await staffApi.confirmCsvImport(file, sendInvites);
      setResults(data);
      toast.success("Import finished");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl overflow-x-hidden">
      <PageHeader
        eyebrow="Staff"
        backTo="/staff"
        backLabel="Back to Staff"
        title="Import staff"
        subtitle="Upload a CSV to preview rows before creating staff records. Nothing is saved until you confirm."
      />

      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">CSV file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 min-w-0">
          <p className="text-sm text-muted-foreground">
            Required columns: Display Name, Legal First Name, Legal Last Name, Role, Email Address,
            Phone Number, Home Address, City.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
            disabled={loading}
            onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <p className="text-xs text-muted-foreground">
              Limits: up to {preview.limits.maxRows} rows, {Math.round(preview.limits.maxBytes / 1024)}{" "}
              KB max file size.
            </p>
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
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-4 text-sm">
              <Stat label="Total rows" value={preview.summary.total} />
              <Stat label="Valid" value={preview.summary.valid} />
              <Stat label="Invalid" value={preview.summary.invalid} />
              <Stat label="Duplicate" value={preview.summary.duplicate} />
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
              </Button>
            ))}
          </div>

          <div className="rounded-lg border border-border/70 overflow-x-auto max-w-full">
            <table className="w-full table-fixed sm:table-auto text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2 font-medium w-12">Row</th>
                  <th className="p-2 font-medium min-w-0">Name</th>
                  <th className="p-2 font-medium w-16">Role</th>
                  <th className="p-2 font-medium min-w-0">Email</th>
                  <th className="p-2 font-medium min-w-0">Phone</th>
                  <th className="p-2 font-medium w-24">Status</th>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              disabled={preview.summary.valid === 0 || loading}
              onClick={() => {
                setSendInvites(false);
                setConfirmOpen(true);
              }}
            >
              Import staff only
            </Button>
            <Button
              variant="secondary"
              disabled={preview.summary.valid === 0 || loading}
              onClick={() => {
                setSendInvites(true);
                setConfirmOpen(true);
              }}
            >
              Import and send portal invitations
            </Button>
          </div>
        </>
      ) : null}

      {results ? (
        <Card className="border-border/70 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Import results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm min-w-0">
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Processed" value={results.summary.totalProcessed} />
              <Stat label="Created" value={results.summary.staffCreated} />
              <Stat label="Skipped" value={results.summary.skipped} />
              <Stat label="Duplicates" value={results.summary.duplicates} />
              <Stat label="Failed" value={results.summary.failed} />
              <Stat label="Invites sent" value={results.summary.invitationsSent} />
              <Stat label="Invite email failures" value={results.summary.invitationEmailFailures} />
            </dl>
            <div className="rounded-lg border border-border/70 overflow-x-auto max-w-full max-h-80 overflow-y-auto">
              <table className="w-full table-fixed sm:table-auto text-sm">
                <thead className="bg-muted/50 text-left sticky top-0">
                  <tr>
                    <th className="p-2 w-12">Row</th>
                    <th className="p-2 min-w-0">Email</th>
                    <th className="p-2 min-w-0">Phone</th>
                    <th className="p-2 w-28">Outcome</th>
                    <th className="p-2 min-w-0">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.email}`} className="border-t border-border/60">
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2 break-all">{row.email}</td>
                      <td className="p-2 break-all whitespace-normal">{row.phone || "—"}</td>
                      <td className="p-2">{row.outcome.replace(/_/g, " ")}</td>
                      <td className="p-2 text-muted-foreground">{row.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button asChild variant="outline">
              <Link to="/staff">Return to staff list</Link>
            </Button>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runImport()} disabled={loading}>
              Confirm import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-semibold text-lg">{value}</dd>
    </div>
  );
}

function PreviewRow({ row }: { row: StaffCsvPreviewRow }) {
  const variant =
    row.status === "valid" ? "default" : row.status === "duplicate" ? "secondary" : "destructive";
  return (
    <tr className="border-t border-border/60">
      <td className="p-2">{row.rowNumber}</td>
      <td className="p-2 min-w-0 break-words">{row.displayName || "—"}</td>
      <td className="p-2">{row.role || "—"}</td>
      <td className="p-2 min-w-0 break-all">{row.email || "—"}</td>
      <td className="p-2 min-w-0 break-all whitespace-normal">{row.phone || "—"}</td>
      <td className="p-2">
        <Badge variant={variant}>{row.status}</Badge>
      </td>
      <td className="p-2 text-muted-foreground">{row.issues.join(" ") || "—"}</td>
    </tr>
  );
}
