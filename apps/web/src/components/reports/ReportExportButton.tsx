import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReportCsv } from "@/lib/report-export";
import { toast } from "sonner";

type ReportExportButtonProps = {
  exportPath: string;
  query: Record<string, string | number | boolean | undefined | null | string[]>;
  disabled?: boolean;
  ready?: boolean;
  totalCount?: number;
  label?: string;
};

export function ReportExportButton({
  exportPath,
  query,
  disabled = false,
  ready = true,
  totalCount,
  label = "Export CSV",
}: ReportExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const noData = ready && totalCount === 0;
  const isDisabled = disabled || !ready || exporting || noData;

  async function handleExport() {
    setExporting(true);
    try {
      await downloadReportCsv(exportPath, query);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not export this report. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9"
      aria-label="Export CSV"
      disabled={isDisabled}
      onClick={handleExport}
    >
      <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {exporting ? "Exporting…" : label}
    </Button>
  );
}
