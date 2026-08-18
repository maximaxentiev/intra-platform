import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STAFF_DOCUMENT_TYPES,
  buildOpsCategorySaveFormData,
  CARER_DOCUMENT_CATEGORY_META,
  categoryDraftFromCategory,
  categoryDraftDirty,
  expiryDisplayLabel,
  formatDocumentByteSize,
  formatDocumentDate,
  isStaleSubmissionError,
  mapOpsDocumentsApiError,
  opsStaffDocumentsApi,
  reviewStatusLabel,
  shiftEligibilityReasonLabel,
  validateCategoryDraft,
  type CarerDocumentCategory,
  type CategoryDraft,
  type OpsStaffDocumentsList,
} from "@/lib/ops-staff-documents";
import type { StaffDocumentType } from "@/lib/carer-documents";
import {
  downloadOpsStaffDocumentFile,
  openOpsStaffDocumentFile,
} from "@/lib/staff-document-content";
import { StaffDocumentShareControls } from "@/components/staff/StaffDocumentShareControls";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { IssueNoteCallout } from "@/components/documents/DocumentStatusPills";
import { cn } from "@/lib/utils";

type PanelMode = "review" | "edit" | "details";

function emptyDraft(): CategoryDraft {
  return { retainFileIds: [], newFiles: [], processedDate: "", expiryDate: "" };
}

export function invalidateStaffDocumentQueries(
  qc: ReturnType<typeof useQueryClient>,
  staffId: string,
) {
  void qc.invalidateQueries({ queryKey: ["staff-documents", staffId] });
  void qc.invalidateQueries({ queryKey: ["staff-list"] });
  void qc.invalidateQueries({ queryKey: ["staff", staffId] });
}

/** Compact status line: review status, then expiry information when relevant. */
function statusLine(category: CarerDocumentCategory): string {
  if (!category.isSubmitted) return "Not submitted";
  const parts = [reviewStatusLabel(category.reviewStatus)];
  const expiryLabel = expiryDisplayLabel(category.expiryDisplay);
  if (expiryLabel && expiryLabel !== "Current") {
    parts.push(
      category.expiryDate
        ? `${expiryLabel} · Expires ${formatDocumentDate(category.expiryDate)}`
        : expiryLabel,
    );
  } else if (category.expiryDate) {
    parts.push(`Expires ${formatDocumentDate(category.expiryDate)}`);
  }
  return parts.join(" · ");
}

function statusToneClass(category: CarerDocumentCategory): string {
  if (!category.isSubmitted) return "text-muted-foreground";
  if (category.reviewStatus === "issue_flagged" || category.expiryDisplay === "expired") {
    return "text-destructive";
  }
  if (category.reviewStatus === "pending_review" || category.expiryDisplay === "expiring_soon") {
    return "text-warning";
  }
  if (category.reviewStatus === "approved") return "text-success";
  return "text-muted-foreground";
}

export function StaffDocumentsSection({
  staffId,
  documents,
  isLoading,
  onRefresh,
}: {
  staffId: string;
  documents: OpsStaffDocumentsList | undefined;
  isLoading: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [openType, setOpenType] = useState<StaffDocumentType | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("details");
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft());
  const [savedDraft, setSavedDraft] = useState<CategoryDraft>(emptyDraft());
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<{
    type: StaffDocumentType;
    submissionId: string;
  } | null>(null);
  const [flagTarget, setFlagTarget] = useState<{
    type: StaffDocumentType;
    submissionId: string;
  } | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [clearTarget, setClearTarget] = useState<StaffDocumentType | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editingType = openType !== null && panelMode === "edit" ? openType : null;

  const categoriesByType = useMemo(() => {
    const map = new Map<StaffDocumentType, CarerDocumentCategory>();
    for (const category of documents?.categories ?? []) {
      map.set(category.documentType, category);
    }
    return map;
  }, [documents]);

  useEffect(() => {
    if (!editingType) return;
    const category = categoriesByType.get(editingType);
    if (!category) return;
    const baseline = categoryDraftFromCategory(category);
    setDraft(baseline);
    setSavedDraft(baseline);
    setCategoryError(null);
  }, [editingType, categoriesByType]);

  async function refreshAll() {
    await onRefresh();
    invalidateStaffDocumentQueries(qc, staffId);
  }

  function closePanel() {
    setOpenType(null);
    setPanelMode("details");
    setDraft(emptyDraft());
    setSavedDraft(emptyDraft());
    setCategoryError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openPanel(type: StaffDocumentType, mode: PanelMode) {
    if (openType === type && panelMode === mode) {
      closePanel();
      return;
    }
    setCategoryError(null);
    setOpenType(type);
    setPanelMode(mode);
  }

  async function handleStaleRefresh() {
    toast.message("This submission has been replaced. Refreshing the latest documents.");
    setApproveTarget(null);
    setFlagTarget(null);
    setFlagNote("");
    closePanel();
    await refreshAll();
  }

  async function handleSaveCategory(type: StaffDocumentType) {
    const category = categoriesByType.get(type);
    const validationError = validateCategoryDraft(type, draft, category?.files ?? []);
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    setSaving(true);
    setCategoryError(null);
    try {
      await opsStaffDocumentsApi.saveCategory(
        staffId,
        type,
        buildOpsCategorySaveFormData(type, draft),
      );
      toast.success("Document saved — pending review");
      closePanel();
      await refreshAll();
    } catch (err) {
      setCategoryError(mapOpsDocumentsApiError(err, "Could not save this document."));
      toast.error(mapOpsDocumentsApiError(err, "Could not save this document."));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!approveTarget) return;
    setPendingAction("approve");
    try {
      await opsStaffDocumentsApi.approveSubmission(
        staffId,
        approveTarget.type,
        approveTarget.submissionId,
      );
      toast.success("Document approved");
      setApproveTarget(null);
      closePanel();
      await refreshAll();
    } catch (err) {
      if (isStaleSubmissionError(err)) {
        await handleStaleRefresh();
        return;
      }
      toast.error(mapOpsDocumentsApiError(err, "Could not approve this document."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleFlagIssue() {
    if (!flagTarget) return;
    const note = flagNote.trim();
    if (!note) {
      toast.error("Issue note is required.");
      return;
    }
    if (note.length > 2000) {
      toast.error("Issue note must be 2000 characters or fewer.");
      return;
    }

    setPendingAction("flag");
    try {
      await opsStaffDocumentsApi.flagIssue(
        staffId,
        flagTarget.type,
        flagTarget.submissionId,
        note,
      );
      toast.success("Issue flagged");
      setFlagTarget(null);
      setFlagNote("");
      closePanel();
      await refreshAll();
    } catch (err) {
      if (isStaleSubmissionError(err)) {
        await handleStaleRefresh();
        return;
      }
      toast.error(mapOpsDocumentsApiError(err, "Could not flag this document."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleClear() {
    if (!clearTarget) return;
    setPendingAction("clear");
    try {
      await opsStaffDocumentsApi.clearCategory(staffId, clearTarget);
      toast.success("Current submission cleared");
      setClearTarget(null);
      closePanel();
      await refreshAll();
    } catch (err) {
      toast.error(mapOpsDocumentsApiError(err, "Could not clear this submission."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleViewFile(type: StaffDocumentType, fileId: string) {
    setViewingFileId(fileId);
    try {
      await openOpsStaffDocumentFile({ staffId, documentType: type, fileId });
    } catch (err) {
      toast.error(mapOpsDocumentsApiError(err, "Could not open this file."));
    } finally {
      setViewingFileId(null);
    }
  }

  async function handleDownloadFile(
    type: StaffDocumentType,
    fileId: string,
    filename: string,
  ) {
    setViewingFileId(fileId);
    try {
      await downloadOpsStaffDocumentFile({ staffId, documentType: type, fileId, filename });
    } catch (err) {
      toast.error(mapOpsDocumentsApiError(err, "Could not download this file."));
    } finally {
      setViewingFileId(null);
    }
  }

  if (isLoading && !documents) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading documents…
      </div>
    );
  }

  if (!documents) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Could not load documents. Refresh the page or try again later.</span>
      </p>
    );
  }

  const busy = saving || pendingAction !== null;

  /** Compact file list, used inside review / details / issue panels. */
  function fileList(type: StaffDocumentType, category: CarerDocumentCategory) {
    if (category.files.length === 0) {
      return <p className="text-sm text-muted-foreground">No files submitted.</p>;
    }
    return (
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {category.files.map((file) => (
          <li
            key={file.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                disabled={viewingFileId === file.id}
                onClick={() => void handleViewFile(type, file.id)}
              >
                {viewingFileId === file.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                )}
                View document
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                disabled={viewingFileId === file.id}
                onClick={() => void handleDownloadFile(type, file.id, file.originalFilename)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Download</span>
                <span className="sr-only sm:hidden">Download {file.originalFilename}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3 min-w-0">
      {/* Compact compliance summary — all values come from the backend. */}
      <Card
        className={cn(
          "border-l-4 shadow-sm",
          documents.shiftEligible ? "border-l-success" : "border-l-destructive",
        )}
      >
        <CardContent className="grid gap-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Documents</span>
            <DocumentStatusBadge status={documents.documentStatus} />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                documents.shiftEligible ? "text-success" : "text-destructive",
              )}
            >
              {documents.shiftEligible ? (
                <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              {documents.shiftEligible
                ? "Eligible for shift matching"
                : "Not eligible for shift matching"}
            </p>
            {!documents.shiftEligible && documents.shiftEligibilityReasons.length > 0 ? (
              <p className="pl-6 text-xs text-muted-foreground">
                {documents.shiftEligibilityReasons
                  .map((reason) => shiftEligibilityReasonLabel(reason))
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <StaffDocumentShareControls staffId={staffId} />

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {STAFF_DOCUMENT_TYPES.map((type) => {
          const category = categoriesByType.get(type)!;
          const meta = CARER_DOCUMENT_CATEGORY_META[type];
          const isOpen = openType === type;
          const isEditing = isOpen && panelMode === "edit";
          const needsReview =
            category.isSubmitted &&
            Boolean(category.currentSubmissionId) &&
            (category.reviewStatus === "pending_review" ||
              category.reviewStatus === "issue_flagged");
          const canClear = category.isSubmitted && Boolean(category.currentSubmissionId);
          const panelId = `ops-doc-panel-${type}`;

          const primary = !category.isSubmitted
            ? { label: "Upload", icon: Upload, mode: "edit" as PanelMode }
            : category.reviewStatus === "pending_review"
              ? { label: "Review", icon: Check, mode: "review" as PanelMode }
              : category.reviewStatus === "issue_flagged"
                ? { label: "Review Issue", icon: AlertCircle, mode: "review" as PanelMode }
                : { label: "View", icon: ExternalLink, mode: "details" as PanelMode };
          const PrimaryIcon = primary.icon;

          return (
            <li key={type} className={cn("min-w-0", isOpen && "bg-muted/30")}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="truncate text-sm font-semibold">{meta.title}</p>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {meta.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  <p className={cn("truncate text-xs", statusToneClass(category))}>
                    {statusLine(category)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      primary.mode === "edit" && !category.isSubmitted
                        ? "default"
                        : needsReview
                          ? "default"
                          : "outline"
                    }
                    className="h-9 gap-1.5"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? panelId : undefined}
                    disabled={busy}
                    onClick={() => openPanel(type, primary.mode)}
                  >
                    <PrimaryIcon className="h-4 w-4" aria-hidden />
                    <span>{primary.label}</span>
                    <span className="sr-only"> {meta.title}</span>
                    <ChevronDown
                      aria-hidden
                      className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                    />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0 text-muted-foreground"
                        disabled={busy}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                        <span className="sr-only">More actions for {meta.title}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {category.isSubmitted ? (
                        <DropdownMenuItem onSelect={() => openPanel(type, "details")}>
                          <FileText className="h-4 w-4" aria-hidden />
                          Details &amp; files
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => openPanel(type, "edit")}>
                        {category.isSubmitted ? (
                          <>
                            <Pencil className="h-4 w-4" aria-hidden />
                            Replace
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" aria-hidden />
                            Upload
                          </>
                        )}
                      </DropdownMenuItem>
                      {canClear ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setClearTarget(type)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            Clear Submission
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {isOpen ? (
                <div id={panelId} className="border-t border-border px-3 py-3 sm:px-4">
                  {panelMode === "edit" ? (
                    <div className="space-y-4">
                      {category.reviewStatus === "approved" ? (
                        <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
                          <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Replacing this submission will return it to Pending Review.</span>
                        </p>
                      ) : null}

                      {meta.dateField === "both" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`ops-processed-${type}`}>Processed Date</Label>
                            <Input
                              id={`ops-processed-${type}`}
                              type="date"
                              className="h-10"
                              value={draft.processedDate}
                              disabled={busy}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, processedDate: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`ops-expiry-vsc-${type}`}>Expiry Date</Label>
                            <Input
                              id={`ops-expiry-vsc-${type}`}
                              type="date"
                              className="h-10"
                              value={draft.expiryDate}
                              disabled={busy}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, expiryDate: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      ) : null}

                      {meta.dateField === "expiry" ? (
                        <div className="space-y-1.5 sm:max-w-xs">
                          <Label htmlFor={`ops-expiry-${type}`}>Expiry Date</Label>
                          <Input
                            id={`ops-expiry-${type}`}
                            type="date"
                            className="h-10"
                            value={draft.expiryDate}
                            disabled={busy}
                            onChange={(e) => setDraft((d) => ({ ...d, expiryDate: e.target.value }))}
                          />
                        </div>
                      ) : null}

                      {category.files.filter((f) => draft.retainFileIds.includes(f.id)).length > 0 ||
                      draft.newFiles.length > 0 ? (
                        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                          {category.files
                            .filter((f) => draft.retainFileIds.includes(f.id))
                            .map((file) => (
                              <li
                                key={file.id}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-sm font-medium"
                                    title={file.originalFilename}
                                  >
                                    {file.originalFilename}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDocumentByteSize(file.byteSize)}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                                  disabled={busy}
                                  aria-label={`Remove ${file.originalFilename} from draft`}
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      retainFileIds: d.retainFileIds.filter((id) => id !== file.id),
                                    }))
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          {draft.newFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${index}`}
                              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-warning-soft/40 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium" title={file.name}>
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDocumentByteSize(file.size)} · not saved yet
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                                disabled={busy}
                                aria-label={`Remove ${file.name}`}
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    newFiles: d.newFiles.filter((_, i) => i !== index),
                                  }))
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="space-y-1.5">
                        <Label htmlFor={`ops-files-${type}`}>Add files for {meta.title}</Label>
                        <Input
                          id={`ops-files-${type}`}
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          className="h-10 cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
                          disabled={busy}
                          aria-describedby={`ops-files-hint-${type}`}
                          onChange={(e) => {
                            const incoming = e.target.files ? Array.from(e.target.files) : [];
                            if (!incoming.length) return;
                            setDraft((d) => ({ ...d, newFiles: [...d.newFiles, ...incoming] }));
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        />
                        <p id={`ops-files-hint-${type}`} className="text-xs text-muted-foreground">
                          PDF, PNG, JPG or JPEG · up to 10 files · 50 MB total
                        </p>
                      </div>

                      {categoryError ? (
                        <p
                          role="alert"
                          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                        >
                          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 break-words">{categoryError}</span>
                        </p>
                      ) : null}

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          className="sm:order-2"
                          disabled={busy || !categoryDraftDirty(draft, savedDraft)}
                          onClick={() => void handleSaveCategory(type)}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-muted-foreground sm:order-1"
                          disabled={busy}
                          onClick={closePanel}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {category.reviewStatus === "issue_flagged" && category.issueNote ? (
                        <IssueNoteCallout note={category.issueNote} />
                      ) : null}

                      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                        {category.submittedAt ? (
                          <div>
                            <dt className="inline text-muted-foreground">Submitted: </dt>
                            <dd className="inline font-medium">
                              {formatDocumentDate(category.submittedAt.slice(0, 10))}
                            </dd>
                          </div>
                        ) : null}
                        {category.reviewedAt ? (
                          <div>
                            <dt className="inline text-muted-foreground">Reviewed: </dt>
                            <dd className="inline font-medium">
                              {formatDocumentDate(category.reviewedAt.slice(0, 10))}
                            </dd>
                          </div>
                        ) : null}
                        {category.processedDate ? (
                          <div>
                            <dt className="inline text-muted-foreground">Processed: </dt>
                            <dd className="inline font-medium">
                              {formatDocumentDate(category.processedDate)}
                            </dd>
                          </div>
                        ) : null}
                        {category.expiryDate ? (
                          <div>
                            <dt className="inline text-muted-foreground">Expiry: </dt>
                            <dd className="inline font-medium">
                              {formatDocumentDate(category.expiryDate)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {fileList(type, category)}

                      {panelMode === "review" && needsReview ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            className="h-9"
                            disabled={busy}
                            onClick={() =>
                              setApproveTarget({
                                type,
                                submissionId: category.currentSubmissionId!,
                              })
                            }
                          >
                            <Check className="h-4 w-4" aria-hidden />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 border-warning/40 text-warning hover:bg-warning-soft hover:text-warning"
                            disabled={busy}
                            onClick={() => {
                              setFlagTarget({
                                type,
                                submissionId: category.currentSubmissionId!,
                              });
                              setFlagNote("");
                            }}
                          >
                            <Flag className="h-4 w-4" aria-hidden />
                            Flag an Issue
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 text-muted-foreground sm:ml-auto"
                            disabled={busy}
                            onClick={() => openPanel(type, "edit")}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            Replace
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={approveTarget !== null} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this document submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the current submission as approved for compliance review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "approve"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction === "approve"} onClick={() => void handleApprove()}>
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={flagTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFlagTarget(null);
            setFlagNote("");
          }
        }}
      >
        <DialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Flag document issue</DialogTitle>
            <DialogDescription>
              Describe what the carer needs to fix. This note is visible on the current submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="issue-note">
                Issue note <span className="text-destructive">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">{flagNote.length}/2000</span>
            </div>
            <Textarea
              id="issue-note"
              value={flagNote}
              maxLength={2000}
              rows={5}
              required
              aria-required="true"
              placeholder="e.g. The expiry date on the certificate does not match the date entered."
              disabled={pendingAction === "flag"}
              onChange={(e) => setFlagNote(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction === "flag"}
              onClick={() => {
                setFlagTarget(null);
                setFlagNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pendingAction === "flag" || !flagNote.trim()}
              onClick={() => void handleFlagIssue()}
            >
              Flag Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearTarget !== null} onOpenChange={(open) => !open && setClearTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear current submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current submission from compliance and mark this document as Not
              Submitted. Historical submissions are retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "clear"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction === "clear"} onClick={() => void handleClear()}>
              Clear Submission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
