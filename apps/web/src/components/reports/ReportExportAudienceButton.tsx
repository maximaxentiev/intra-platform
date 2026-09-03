import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { downloadReportCsv } from "@/lib/report-export";
import type { ReportExportAudience } from "@/lib/report-export-audience";
import { toast } from "sonner";

type ExportQuery = Record<string, string | number | boolean | undefined | null | string[]>;

type ReportExportAudienceButtonProps = {
  exportPath: string;
  query: ExportQuery;
  centreIds: string[];
  disabled?: boolean;
  ready?: boolean;
  totalCount?: number;
  label?: string;
};

export function ReportExportAudienceButton({
  exportPath,
  query,
  centreIds,
  disabled = false,
  ready = true,
  totalCount,
  label = "Export CSV",
}: ReportExportAudienceButtonProps) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<ReportExportAudience>("ops");
  const [exporting, setExporting] = useState(false);

  const noData = ready && totalCount === 0;
  const centreExportBlocked = centreIds.length !== 1;
  const isDisabled = disabled || !ready || exporting || noData;

  async function handleExport(selectedAudience: ReportExportAudience) {
    setExporting(true);
    try {
      await downloadReportCsv(exportPath, { ...query, audience: selectedAudience });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not export this report. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  function openDialog() {
    setAudience(centreExportBlocked ? "ops" : "ops");
    setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        aria-label="Export CSV"
        disabled={isDisabled}
        onClick={openDialog}
      >
        <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {exporting ? "Exporting…" : label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export report</DialogTitle>
            <DialogDescription>Who is this report for?</DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={audience}
            onValueChange={(value) => setAudience(value as ReportExportAudience)}
            className="gap-4"
          >
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <RadioGroupItem value="ops" id="export-audience-ops" className="mt-0.5" />
              <Label htmlFor="export-audience-ops" className="cursor-pointer space-y-1 font-normal">
                <span className="block font-medium text-foreground">Ops team</span>
                <span className="block text-sm text-muted-foreground">Uses Carer display names.</span>
              </Label>
            </div>

            <div
              className={
                centreExportBlocked
                  ? "flex items-start gap-3 rounded-lg border border-dashed p-4 opacity-60"
                  : "flex items-start gap-3 rounded-lg border p-4"
              }
            >
              <RadioGroupItem
                value="centre"
                id="export-audience-centre"
                className="mt-0.5"
                disabled={centreExportBlocked}
              />
              <Label
                htmlFor="export-audience-centre"
                className={
                  centreExportBlocked
                    ? "space-y-1 font-normal"
                    : "cursor-pointer space-y-1 font-normal"
                }
              >
                <span className="block font-medium text-foreground">Centre</span>
                <span className="block text-sm text-muted-foreground">Uses Carer legal names.</span>
                {centreExportBlocked ? (
                  <span className="block text-sm text-muted-foreground">
                    Select a Centre before exporting a Centre version.
                  </span>
                ) : null}
              </Label>
            </div>
          </RadioGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleExport(audience)}
              disabled={exporting || (audience === "centre" && centreExportBlocked)}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
