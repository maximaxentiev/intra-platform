import { ExternalLink, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatDocumentByteSize,
  type CarerDocumentCategory,
  type CategoryDraft,
  type StaffDocumentType,
} from "@/lib/carer-documents";
import { CARER_DOCUMENT_CATEGORY_META } from "@/lib/carer-documents";

type CarerOnboardingDocumentCardProps = {
  category: CarerDocumentCategory;
  draft: CategoryDraft;
  error?: string;
  meta: (typeof CARER_DOCUMENT_CATEGORY_META)[StaffDocumentType];
  viewingFileId: string | null;
  disabled: boolean;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onProcessedDateChange: (value: string) => void;
  onExpiryDateChange: (value: string) => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveNewFile: (index: number) => void;
  onRemoveRetainedFile: (fileId: string) => void;
  onViewFile: (fileId: string) => void;
};

export function CarerOnboardingDocumentCard({
  category,
  draft,
  error,
  meta,
  viewingFileId,
  disabled,
  fileInputRef,
  onProcessedDateChange,
  onExpiryDateChange,
  onFilesSelected,
  onRemoveNewFile,
  onRemoveRetainedFile,
  onViewFile,
}: CarerOnboardingDocumentCardProps) {
  const inputId = `onboarding-files-${category.documentType}`;
  const retainedFiles = category.files.filter((f) => draft.retainFileIds.includes(f.id));
  const fileCount = retainedFiles.length + draft.newFiles.length;
  const showProcessedDate = meta.dateField === "processed" && fileCount > 0;
  const showExpiryDate = meta.dateField === "expiry" && fileCount > 0;

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 shadow-xs"
      aria-labelledby={`onboarding-doc-${category.documentType}`}
    >
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2
          id={`onboarding-doc-${category.documentType}`}
          className="text-lg font-bold leading-snug text-foreground"
        >
          {meta.title}
        </h2>
        <span className="text-sm font-medium text-muted-foreground">
          {meta.required ? "Required" : "Optional"}
        </span>
      </div>

      {fileCount > 0 ? (
        <ul className="mb-4 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {retainedFiles.map((file) => (
            <li
              key={file.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <p className="truncate text-sm font-medium" title={file.originalFilename}>
                  {file.originalFilename}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  disabled={disabled || viewingFileId === file.id}
                  onClick={() => onViewFile(file.id)}
                >
                  {viewingFileId === file.id ? (
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0"
                  disabled={disabled}
                  aria-label={`Remove ${file.originalFilename}`}
                  onClick={() => onRemoveRetainedFile(file.id)}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
          {draft.newFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveNewFile(index)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onFilesSelected(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled}
        className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload aria-hidden="true" className="h-4 w-4 text-primary" />
          {fileCount > 0 ? "Add more documents" : "Add documents"}
        </span>
        <span className="text-xs text-muted-foreground">
          PDF, PNG, JPG or JPEG · up to 10 files · 50 MB total
        </span>
      </button>

      {showProcessedDate ? (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor={`processed-${category.documentType}`}>Processed date</Label>
          <Input
            id={`processed-${category.documentType}`}
            type="date"
            className="h-11"
            value={draft.processedDate}
            disabled={disabled}
            onChange={(e) => onProcessedDateChange(e.target.value)}
          />
        </div>
      ) : null}

      {showExpiryDate ? (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor={`expiry-${category.documentType}`}>Expiry date</Label>
          <Input
            id={`expiry-${category.documentType}`}
            type="date"
            className="h-11"
            value={draft.expiryDate}
            disabled={disabled}
            onChange={(e) => onExpiryDateChange(e.target.value)}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
