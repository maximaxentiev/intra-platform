import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportDateRangeFields } from "@/components/reports/ReportFilterPrimitives";
import {
  downloadCentreShiftHistoryCsv,
  fetchCentreShiftHistoryPreview,
  sendCentreShiftHistoryEmail,
} from "@/lib/centre-shift-history";
import { defaultReportSearch } from "@/lib/reports-dates";
import { toast } from "sonner";

type CentreShiftHistoryDialogProps = {
  centreId: string;
  centreName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CentreShiftHistoryDialog({
  centreId,
  centreName,
  open,
  onOpenChange,
}: CentreShiftHistoryDialogProps) {
  const defaults = defaultReportSearch();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
  }, [open]);

  const previewQ = useQuery({
    queryKey: ["centre-shift-history-preview", centreId, dateFrom, dateTo],
    queryFn: () => fetchCentreShiftHistoryPreview(centreId, dateFrom, dateTo),
    enabled: open && Boolean(dateFrom && dateTo),
  });

  const preview = previewQ.data;
  const busy = downloading || sending;

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadCentreShiftHistoryCsv(centreId, dateFrom, dateTo);
      toast.success("Shift history CSV downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      const result = await sendCentreShiftHistoryEmail(centreId, dateFrom, dateTo);
      toast.success(
        `Shift history email scheduled (${result.shiftCount} shift${result.shiftCount === 1 ? "" : "s"})`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email shift history</DialogTitle>
          <DialogDescription>
            Generate a Centre-facing CSV of Shifts for {centreName} and optionally email it to the
            primary contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ReportDateRangeFields
            label="Date range"
            fromId="centre-shift-history-from"
            toId="centre-shift-history-to"
            fromValue={dateFrom}
            toValue={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />

          {preview?.recipient ? (
            <p className="text-sm text-muted-foreground">
              Sending to:{" "}
              <span className="text-foreground">
                {preview.recipient.name} · {preview.recipient.email}
              </span>
            </p>
          ) : previewQ.isSuccess ? (
            <p className="text-sm text-destructive">
              {preview?.missingPrimaryContactMessage ??
                "Add a primary Centre contact with a valid email before sending."}
            </p>
          ) : null}

          {previewQ.isFetching ? (
            <p className="text-sm text-muted-foreground">Checking shift history…</p>
          ) : preview?.shiftCount != null && preview.shiftCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {preview.shiftCount} shift{preview.shiftCount === 1 ? "" : "s"} found
            </p>
          ) : null}

          {preview?.emptyMessage ? (
            <p className="text-sm text-muted-foreground">{preview.emptyMessage}</p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !preview?.canDownloadCsv || previewQ.isFetching}
            onClick={() => void handleDownload()}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {downloading ? "Downloading…" : "Download CSV"}
          </Button>
          <Button
            type="button"
            disabled={busy || !preview?.canSendEmail || previewQ.isFetching}
            onClick={() => void handleSend()}
          >
            <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {sending ? "Sending…" : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
