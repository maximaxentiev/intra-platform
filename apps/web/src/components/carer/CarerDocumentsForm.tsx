import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  buildCategorySaveFormData,
  CARER_DOCUMENT_CATEGORY_META,
  categoryDraftDirty,
  categoryDraftFromCategory,
  deriveVscRenewalDueDate,
  documentsDraftDirty,
  emptyCategoryDrafts,
  formatDocumentByteSize,
  formatDocumentDate,
  formatVscRenewalDueLabel,
  mapDocumentsApiError,
  qualificationTypesForStaffRole,
  QUALIFICATIONS_SECTION_COPY,
  STAFF_COMPLIANCE_DOCUMENT_TYPES,
  validateCategoryDraft,
  carerDocumentsApi,
  type CarerDocumentCategory,
  type CarerDocumentsList,
  type CategoryDraft,
  type StaffDocumentType,
} from "@/lib/carer-documents";
import { openStaffDocumentFile } from "@/lib/staff-document-content";
import {
  IssueNoteCallout,
  RequirementPill,
  UnsavedPill,
} from "@/components/documents/DocumentStatusPills";
import { cn } from "@/lib/utils";
import { carerDocumentCarerFacingStatus } from "@/lib/carer-documents";

function emptyDrafts(): Record<StaffDocumentType, CategoryDraft> {
  return emptyCategoryDrafts();
}

function draftsFromDocuments(documents: CarerDocumentsList): Record<StaffDocumentType, CategoryDraft> {
  const next = emptyDrafts();
  for (const category of documents.categories) {
    next[category.documentType] = categoryDraftFromCategory(category);
  }
  return next;
}

export function CarerDocumentsForm({
  documents,
  isLoading,
  mode = "onboarding",
  step2Complete = false,
  onRefresh,
  onStepComplete,
}: {
  documents: CarerDocumentsList | undefined;
  isLoading: boolean;
  mode?: "onboarding" | "account";
  step2Complete?: boolean;
  onRefresh: () => Promise<unknown>;
  onStepComplete?: () => void;
}) {
  const navigate = useNavigate();
  const [savedDrafts, setSavedDrafts] = useState(emptyDrafts);
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [categoryErrors, setCategoryErrors] = useState<Partial<Record<StaffDocumentType, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const fileInputs = useRef<Partial<Record<StaffDocumentType, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!documents) return;
    const baseline = draftsFromDocuments(documents);
    setSavedDrafts(baseline);
    setDrafts(baseline);
    setCategoryErrors({});
    setFormError(null);
  }, [documents]);

  const isDirty = useMemo(() => documentsDraftDirty(drafts, savedDrafts), [drafts, savedDrafts]);
  const { blocker, allowNavigationOnce } = useUnsavedChangesGuard(isDirty);

  const categoriesByType = useMemo(() => {
    const map = new Map<StaffDocumentType, CarerDocumentCategory>();
    for (const category of documents?.categories ?? []) {
      map.set(category.documentType, category);
    }
    return map;
  }, [documents]);

  function updateDraft(type: StaffDocumentType, patch: Partial<CategoryDraft>) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
    setCategoryErrors((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setFormError(null);
  }

  function handleFilesSelected(type: StaffDocumentType, fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    updateDraft(type, {
      newFiles: [...drafts[type].newFiles, ...incoming],
    });
    const input = fileInputs.current[type];
    if (input) input.value = "";
  }

  function removeNewFile(type: StaffDocumentType, index: number) {
    updateDraft(type, {
      newFiles: drafts[type].newFiles.filter((_, i) => i !== index),
    });
  }

  function removeRetainedFile(type: StaffDocumentType, fileId: string) {
    updateDraft(type, {
      retainFileIds: drafts[type].retainFileIds.filter((id) => id !== fileId),
    });
  }

  function confirmDiscard() {
    setDrafts(savedDrafts);
    setCategoryErrors({});
    setFormError(null);
    setDiscardOpen(false);
  }

  async function saveDirtyCategories(): Promise<boolean> {
    if (!documents) return false;
    const dirtyTypes = [...STAFF_COMPLIANCE_DOCUMENT_TYPES, ...qualificationTypesForStaffRole(documents.staffRole)].filter(
      (type) => categoryDraftDirty(drafts[type], savedDrafts[type], type),
    );
    if (!dirtyTypes.length) return true;

    setSaving(true);
    let allOk = true;
    const nextErrors: Partial<Record<StaffDocumentType, string>> = {};

    for (const type of dirtyTypes) {
      const category = categoriesByType.get(type);
      const validationError = validateCategoryDraft(type, drafts[type], category?.files ?? []);
      if (validationError) {
        nextErrors[type] = validationError;
        allOk = false;
        continue;
      }

      try {
        await carerDocumentsApi.saveCategory(type, buildCategorySaveFormData(type, drafts[type]));
      } catch (err) {
        nextErrors[type] = mapDocumentsApiError(err, "Could not save this document.");
        allOk = false;
      }
    }

    setSaving(false);
    setCategoryErrors(nextErrors);

    if (allOk) {
      await onRefresh();
      toast.success("Documents saved");
      return true;
    }

    setFormError("Some documents could not be saved. Fix the highlighted sections and try again.");
    toast.error("Some documents could not be saved.");
    return false;
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setFormError(null);
    await saveDirtyCategories();
  }

  async function handleNext() {
    setFormError(null);
    setAdvancing(true);
    try {
      const saved = await saveDirtyCategories();
      if (!saved) return;

      const refreshed = await carerDocumentsApi.get();
      await onRefresh();

      if (!refreshed.canCompleteStep2) {
        const message =
          "Required documents must be submitted with valid dates and must not be expired.";
        setFormError(message);
        toast.error(message);
        return;
      }

      if (!step2Complete) {
        await carerDocumentsApi.completeStep2();
        await onRefresh();
      }

      allowNavigationOnce();
      if (mode === "onboarding") {
        onStepComplete?.();
      }
    } catch (err) {
      const message = mapDocumentsApiError(err, "Could not continue to the next step.");
      setFormError(message);
      toast.error(message);
    } finally {
      setAdvancing(false);
    }
  }

  async function handleViewFile(type: StaffDocumentType, fileId: string) {
    setViewingFileId(fileId);
    try {
      await openStaffDocumentFile({ documentType: type, fileId });
    } catch (err) {
      toast.error(mapDocumentsApiError(err, "Could not open this file."));
    } finally {
      setViewingFileId(null);
    }
  }

  function handleBackRequest() {
    if (!isDirty) {
      allowNavigationOnce();
      navigate({ to: "/carer/onboarding/profile" });
      return;
    }
    setBackConfirmOpen(true);
  }

  const busy = saving || advancing;

  if (isLoading && !documents) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading your documents…
      </div>
    );
  }

  if (!documents) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Could not load your documents. Refresh the page or try again later.</span>
      </p>
    );
  }

  const qualificationTypes = qualificationTypesForStaffRole(documents.staffRole);

  return (
    <>
      <form onSubmit={(e) => void handleSave(e)} className="space-y-4 min-w-0 overflow-x-hidden">
        <div className="flex items-center justify-end gap-2">
          {mode === "onboarding" ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto h-10 justify-self-start px-0 text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={handleBackRequest}
            >
              <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Personal Information
            </Button>
          ) : null}
          {isDirty ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
              Unsaved changes
            </span>
          ) : null}
        </div>


        <div className="space-y-4">
          {STAFF_COMPLIANCE_DOCUMENT_TYPES.map((type) => {
            const category = categoriesByType.get(type)!;
            const meta = CARER_DOCUMENT_CATEGORY_META[type];
            const draft = drafts[type];
            const dirty = categoryDraftDirty(draft, savedDrafts[type], type);
            return (
              <CarerDocumentCategoryCard
                key={type}
                category={category}
                draft={draft}
                dirty={dirty}
                error={categoryErrors[type]}
                meta={meta}
                viewingFileId={viewingFileId}
                disabled={busy}
                fileInputRef={(el) => {
                  fileInputs.current[type] = el;
                }}
                onProcessedDateChange={(value) => updateDraft(type, { processedDate: value })}
                onExpiryDateChange={(value) => updateDraft(type, { expiryDate: value })}
                onFilesSelected={(files) => handleFilesSelected(type, files)}
                onRemoveNewFile={(index) => removeNewFile(type, index)}
                onRemoveRetainedFile={(fileId) => removeRetainedFile(type, fileId)}
                onViewFile={(fileId) => void handleViewFile(type, fileId)}
              />
            );
          })}
        </div>

        {qualificationTypes.length > 0 ? (
          <div className="space-y-3 border-t border-border/70 pt-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Qualifications (Optional)</h2>
              <p className="text-sm text-muted-foreground">{QUALIFICATIONS_SECTION_COPY}</p>
            </div>
            <div className="space-y-4">
              {qualificationTypes.map((type) => {
                const category = categoriesByType.get(type)!;
                const meta = CARER_DOCUMENT_CATEGORY_META[type];
                const draft = drafts[type];
                const dirty = categoryDraftDirty(draft, savedDrafts[type], type);
                return (
                  <CarerDocumentCategoryCard
                    key={type}
                    category={category}
                    draft={draft}
                    dirty={dirty}
                    error={categoryErrors[type]}
                    meta={meta}
                    viewingFileId={viewingFileId}
                    disabled={busy}
                    fileInputRef={(el) => {
                      fileInputs.current[type] = el;
                    }}
                    onProcessedDateChange={(value) => updateDraft(type, { processedDate: value })}
                    onExpiryDateChange={(value) => updateDraft(type, { expiryDate: value })}
                    onFilesSelected={(files) => handleFilesSelected(type, files)}
                    onRemoveNewFile={(index) => removeNewFile(type, index)}
                    onRemoveRetainedFile={(fileId) => removeRetainedFile(type, fileId)}
                    onViewFile={(fileId) => void handleViewFile(type, fileId)}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        <div aria-live="polite" className="space-y-2">
          {formError ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{formError}</span>
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 z-10 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:static sm:bg-card sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {mode === "onboarding" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full justify-center text-muted-foreground hover:text-foreground sm:order-1 sm:w-auto sm:justify-start"
                disabled={busy}
                onClick={handleBackRequest}
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-muted-foreground sm:order-2 sm:ml-auto sm:w-auto"
              disabled={busy || !isDirty}
              onClick={() => setDiscardOpen(true)}
            >
              Discard
            </Button>
            <Button
              type="submit"
              variant={mode === "onboarding" ? "outline" : "default"}
              className={`h-11 w-full sm:order-3 sm:w-auto ${mode === "account" ? "sm:ml-0" : ""}`}
              disabled={busy || !isDirty}
            >
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </Button>
            {mode === "onboarding" ? (
              <Button
                type="button"
                className="h-11 w-full font-medium sm:order-4 sm:w-auto"
                disabled={busy}
                onClick={() => void handleNext()}
              >
                {advancing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                Continue to availability
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground sm:text-right">
            {mode === "onboarding"
              ? "Continue to availability saves your changes and opens the availability step."
              : "Changes are only stored once you save."}
          </p>
        </div>

      </form>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits on this page will be cleared and your last saved documents restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11">Keep editing</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={confirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved document changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11">Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                allowNavigationOnce();
                setBackConfirmOpen(false);
                navigate({ to: "/carer/onboarding/profile" });
              }}
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved document changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-11" onClick={() => blocker.reset?.()}>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                allowNavigationOnce();
                blocker.proceed?.();
              }}
            >
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CarerDocumentCategoryCard({
  category,
  draft,
  dirty,
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
}: {
  category: CarerDocumentCategory;
  draft: CategoryDraft;
  dirty: boolean;
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
}) {
  const inputId = `files-${category.documentType}`;
  const retainedFiles = category.files.filter((f) => draft.retainFileIds.includes(f.id));
  const fileCount = retainedFiles.length + draft.newFiles.length;
  const vscRenewalDue =
    category.documentType === "vulnerable_sector_check"
      ? formatVscRenewalDueLabel(
          category.expiryDate ??
            (draft.processedDate ? deriveVscRenewalDueDate(draft.processedDate) : null),
        )
      : null;

  return (
    <Card
      className="min-w-0 border-border/70 shadow-sm"
      role="group"
      aria-labelledby={`doc-title-${category.documentType}`}
    >
      <CardHeader className="gap-2 pb-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle id={`doc-title-${category.documentType}`} className="text-base leading-snug">
                {meta.title}
              </CardTitle>
              <RequirementPill required={meta.required} />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <CarerDocumentStatusLine category={category} />
            {dirty ? <UnsavedPill /> : null}
          </div>
        </div>

        {category.reviewStatus === "issue_flagged" && category.issueNote ? (
          <IssueNoteCallout note={category.issueNote} />
        ) : null}

      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {meta.dateField === "processed" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`processed-${category.documentType}`}>Processed Date</Label>
              <Input
                id={`processed-${category.documentType}`}
                type="date"
                className="h-11"
                value={draft.processedDate}
                disabled={disabled}
                onChange={(e) => onProcessedDateChange(e.target.value)}
              />
            </div>
            {vscRenewalDue ? (
              <div className="space-y-1.5 sm:self-end">
                <p className="text-sm text-muted-foreground">{vscRenewalDue}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {meta.dateField === "expiry" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`expiry-${category.documentType}`}>Expiry Date</Label>
              <Input
                id={`expiry-${category.documentType}`}
                type="date"
                className="h-11"
                value={draft.expiryDate}
                disabled={disabled}
                onChange={(e) => onExpiryDateChange(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={inputId} className="text-sm">
              Files
            </Label>
            {fileCount === 0 ? (
              <span className="text-xs text-muted-foreground">None attached</span>
            ) : null}
          </div>

          {fileCount > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {retainedFiles.map((file) => (
                <li
                  key={file.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-primary/25 bg-primary-soft px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={file.originalFilename}>
                        {file.originalFilename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDocumentByteSize(file.byteSize)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5"
                      disabled={disabled || viewingFileId === file.id}
                      onClick={() => onViewFile(file.id)}
                    >
                      {viewingFileId === file.id ? (
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">View</span>
                      <span className="sr-only sm:hidden">View {file.originalFilename}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      disabled={disabled}
                      aria-label={`Remove ${file.originalFilename} from this save`}
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-primary/25 bg-primary-soft px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDocumentByteSize(file.size)} · not saved yet
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
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
            aria-describedby={`upload-hint-${category.documentType}`}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Upload aria-hidden="true" className="h-4 w-4 text-primary" />
              {fileCount > 0 ? "Add more files" : "Add files"}
            </span>
            <span id={`upload-hint-${category.documentType}`} className="text-xs text-muted-foreground">
              PDF, PNG, JPG or JPEG · up to 10 files · 50 MB total
            </span>
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        ) : null}

      </CardContent>
    </Card>
  );
}


function CarerDocumentStatusLine({ category }: { category: CarerDocumentCategory }) {
  const status = carerDocumentCarerFacingStatus(category);
  if (!status) return null;

  const toneClass =
    status.tone === "destructive"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : status.tone === "warning"
        ? "border-warning/30 bg-warning-soft text-warning"
        : "border-info/25 bg-info-soft text-info";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass,
      )}
    >
      {status.label}
    </span>
  );
}


export function CarerDocumentsBackLink() {
  return (
    <Link to="/carer/onboarding/profile" className="sr-only">
      Personal Information
    </Link>
  );
}
