import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";

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
  const [editingType, setEditingType] = useState<StaffDocumentType | null>(null);
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

  async function handleStaleRefresh() {
    toast.message("This submission has been replaced. Refreshing the latest documents.");
    setApproveTarget(null);
    setFlagTarget(null);
    setFlagNote("");
    setEditingType(null);
    await refreshAll();
  }

  function startEdit(type: StaffDocumentType) {
    setEditingType(type);
  }

  function cancelEdit() {
    setEditingType(null);
    setDraft(emptyDraft());
    setSavedDraft(emptyDraft());
    setCategoryError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      setEditingType(null);
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
      setEditingType(null);
      await refreshAll();
    } catch (err) {
      toast.error(mapOpsDocumentsApiError(err, "Could not clear this submission."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReminderToggle(type: StaffDocumentType, enabled: boolean) {
    setPendingAction(`reminder-${type}`);
    try {
      await opsStaffDocumentsApi.setReminders(staffId, type, enabled);
      toast.success(enabled ? "Automated reminders enabled" : "Automated reminders disabled");
      await refreshAll();
    } catch (err) {
      toast.error(mapOpsDocumentsApiError(err, "Could not update reminder settings."));
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

  return (
    <div className="space-y-4 min-w-0">
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compliance summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Document status:</span>
            <DocumentStatusBadge status={documents.documentStatus} />
          </div>
          <div>
            {documents.shiftEligible ? (
              <p className="font-medium text-success">Eligible for shift matching</p>
            ) : (
              <div className="space-y-1">
                <p className="font-medium text-destructive">Not eligible for shift matching</p>
                {documents.shiftEligibilityReasons.length > 0 ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {documents.shiftEligibilityReasons.map((reason) => (
                      <li key={reason}>{shiftEligibilityReasonLabel(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {STAFF_DOCUMENT_TYPES.map((type) => {
        const category = categoriesByType.get(type)!;
        const meta = CARER_DOCUMENT_CATEGORY_META[type];
        const isEditing = editingType === type;
        const showReminderToggle =
          type === "vulnerable_sector_check" || type === "first_aid_cpr";
        const canReview =
          category.isSubmitted &&
          category.currentSubmissionId &&
          (category.reviewStatus === "pending_review" ||
            category.reviewStatus === "issue_flagged");
        const canClear = category.isSubmitted && category.currentSubmissionId;

        return (
          <Card key={type} className="min-w-0 border-border/70">
            <CardHeader className="gap-2 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                  >
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{meta.title}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {meta.required ? "Required" : "Optional"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{reviewStatusLabel(category.reviewStatus)}</Badge>
                  {expiryDisplayLabel(category.expiryDisplay) ? (
                    <Badge variant="outline">{expiryDisplayLabel(category.expiryDisplay)}</Badge>
                  ) : null}
                </div>
              </div>

              {category.reviewStatus === "issue_flagged" && category.issueNote ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">Issue flagged.</span> {category.issueNote}
                  </span>
                </p>
              ) : null}

              {!isEditing && category.isSubmitted ? (
                <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {category.submittedAt ? (
                    <div>
                      <dt className="inline font-medium text-foreground">Submitted: </dt>
                      <dd className="inline">{formatDocumentDate(category.submittedAt.slice(0, 10))}</dd>
                    </div>
                  ) : null}
                  {category.reviewedAt ? (
                    <div>
                      <dt className="inline font-medium text-foreground">Reviewed: </dt>
                      <dd className="inline">{formatDocumentDate(category.reviewedAt.slice(0, 10))}</dd>
                    </div>
                  ) : null}
                  {category.processedDate ? (
                    <div>
                      <dt className="inline font-medium text-foreground">Processed: </dt>
                      <dd className="inline">{formatDocumentDate(category.processedDate)}</dd>
                    </div>
                  ) : null}
                  {category.expiryDate ? (
                    <div>
                      <dt className="inline font-medium text-foreground">Expiry: </dt>
                      <dd className="inline">{formatDocumentDate(category.expiryDate)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  {category.reviewStatus === "approved" ? (
                    <p className="text-xs text-muted-foreground">
                      Replacing this submission will return it to Pending Review.
                    </p>
                  ) : null}

                  {meta.dateField === "processed" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={`ops-processed-${type}`}>Processed Date</Label>
                      <Input
                        id={`ops-processed-${type}`}
                        type="date"
                        className="h-10"
                        value={draft.processedDate}
                        disabled={busy}
                        onChange={(e) => setDraft((d) => ({ ...d, processedDate: e.target.value }))}
                      />
                    </div>
                  ) : null}

                  {meta.dateField === "expiry" ? (
                    <div className="space-y-1.5">
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

                  {category.files.filter((f) => draft.retainFileIds.includes(f.id)).length > 0 ? (
                    <ul className="space-y-2">
                      {category.files
                        .filter((f) => draft.retainFileIds.includes(f.id))
                        .map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 break-all">{file.originalFilename}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDocumentByteSize(file.byteSize)}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8"
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
                    </ul>
                  ) : null}

                  {draft.newFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 break-all">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDocumentByteSize(file.size)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
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
                    </div>
                  ))}

                  <div>
                    <Label htmlFor={`ops-files-${type}`} className="sr-only">
                      Upload files for {meta.title}
                    </Label>
                    <Input
                      id={`ops-files-${type}`}
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      className="h-10"
                      disabled={busy}
                      onChange={(e) => {
                        const incoming = e.target.files ? Array.from(e.target.files) : [];
                        if (!incoming.length) return;
                        setDraft((d) => ({ ...d, newFiles: [...d.newFiles, ...incoming] }));
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                  </div>

                  {categoryError ? (
                    <p className="text-sm text-destructive">{categoryError}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy || !categoryDraftDirty(draft, savedDraft)}
                      onClick={() => void handleSaveCategory(type)}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      Save
                    </Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {category.files.length > 0 ? (
                    <ul className="space-y-2">
                      {category.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 flex-1 break-all">{file.originalFilename}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDocumentByteSize(file.byteSize)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={viewingFileId === file.id}
                            onClick={() => void handleViewFile(type, file.id)}
                          >
                            {viewingFileId === file.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden />
                            )}
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            disabled={viewingFileId === file.id}
                            onClick={() => void handleDownloadFile(type, file.id, file.originalFilename)}
                          >
                            <Download className="h-3.5 w-3.5 mr-1" aria-hidden />
                            Download
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No files submitted.</p>
                  )}

                  {showReminderToggle ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <Label htmlFor={`reminder-${type}`} className="text-sm font-normal">
                        Automated expiry reminders
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {category.remindersEnabled ? "On" : "Off"}
                        </span>
                        <Switch
                          id={`reminder-${type}`}
                          checked={category.remindersEnabled}
                          disabled={busy}
                          aria-label={`Automated expiry reminders for ${meta.title}`}
                          onCheckedChange={(checked) => void handleReminderToggle(type, checked)}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {canReview ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setApproveTarget({
                              type,
                              submissionId: category.currentSubmissionId!,
                            })
                          }
                        >
                          <Check className="h-4 w-4 mr-1.5" aria-hidden />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setFlagTarget({
                              type,
                              submissionId: category.currentSubmissionId!,
                            });
                            setFlagNote("");
                          }}
                        >
                          <Flag className="h-4 w-4 mr-1.5" aria-hidden />
                          Flag Issue
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => startEdit(type)}
                    >
                      {category.isSubmitted ? (
                        <>
                          <Pencil className="h-4 w-4 mr-1.5" aria-hidden />
                          Replace
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" aria-hidden />
                          Upload
                        </>
                      )}
                    </Button>
                    {canClear ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => setClearTarget(type)}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" aria-hidden />
                        Clear Submission
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag document issue</DialogTitle>
            <DialogDescription>
              Describe what the carer needs to fix. This note is visible on the current submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="issue-note">Issue note</Label>
            <Textarea
              id="issue-note"
              value={flagNote}
              maxLength={2000}
              rows={4}
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
