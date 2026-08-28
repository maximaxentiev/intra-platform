import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Link2, Loader2, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ApiError } from "@/lib/api";
import {
  STAFF_DOCUMENT_SHARE_POLICY,
  copyTextToClipboard,
  opsStaffDocumentShareApi,
} from "@/lib/ops-staff-document-share";

function shareQueryKey(staffId: string) {
  return ["staff-document-share", staffId] as const;
}

function mapShareApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function StaffDocumentShareControls({ staffId }: { staffId: string }) {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const shareQ = useQuery({
    queryKey: shareQueryKey(staffId),
    queryFn: () => opsStaffDocumentShareApi.getStatus(staffId),
  });

  async function invalidateShareStatus() {
    await qc.invalidateQueries({ queryKey: shareQueryKey(staffId) });
  }

  async function deliverShareUrl(shareUrl: string, successMessage = "Share link copied") {
    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      toast.success(successMessage);
      return;
    }
    setFallbackUrl(shareUrl);
  }

  async function handleGenerate() {
    setPendingAction("generate");
    try {
      const result = await opsStaffDocumentShareApi.generate(staffId);
      await invalidateShareStatus();
      await deliverShareUrl(result.shareUrl);
    } catch (err) {
      toast.error(mapShareApiError(err, "Could not generate a share link."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopy() {
    setPendingAction("copy");
    try {
      const result = await opsStaffDocumentShareApi.copyLink(staffId);
      await deliverShareUrl(result.shareUrl);
    } catch (err) {
      toast.error(mapShareApiError(err, "Could not copy the share link."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRotate() {
    setPendingAction("rotate");
    try {
      const result = await opsStaffDocumentShareApi.rotate(staffId);
      await invalidateShareStatus();
      setRotateOpen(false);
      await deliverShareUrl(result.shareUrl, "New share link copied. The previous link no longer works.");
    } catch (err) {
      toast.error(mapShareApiError(err, "Could not rotate the share link."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRevoke() {
    setPendingAction("revoke");
    try {
      await opsStaffDocumentShareApi.revoke(staffId);
      await invalidateShareStatus();
      setRevokeOpen(false);
      toast.success("Share link revoked");
    } catch (err) {
      toast.error(mapShareApiError(err, "Could not revoke the share link."));
    } finally {
      setPendingAction(null);
    }
  }

  const state = shareQ.data?.state ?? "none";
  const isBusy = pendingAction !== null || shareQ.isLoading;

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="text-sm font-medium">Share documents</h3>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{STAFF_DOCUMENT_SHARE_POLICY}</p>

          <div aria-live="polite">
            {shareQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Loading share status…
              </div>
            ) : null}

            {!shareQ.isLoading && state !== "active" ? (
              <Button
                type="button"
                className="h-11 w-full sm:w-auto"
                disabled={isBusy}
                onClick={() => void handleGenerate()}
              >
                {pendingAction === "generate" ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : state === "revoked" ? (
                  "Generate new link"
                ) : (
                  "Generate share link"
                )}
              </Button>
            ) : null}

            {!shareQ.isLoading && state === "active" ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  className="h-11 w-full sm:w-auto"
                  disabled={isBusy || !shareQ.data?.canCopy}
                  onClick={() => void handleCopy()}
                >
                  {pendingAction === "copy" ? (
                    <>
                      <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                      Copying…
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="mr-2 h-4 w-4" />
                      Copy link
                    </>
                  )}
                </Button>
                <div className="flex gap-2 sm:ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 flex-1 text-muted-foreground sm:flex-none"
                    disabled={isBusy}
                    onClick={() => setRotateOpen(true)}
                  >
                    <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
                    Rotate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
                    disabled={isBusy}
                    onClick={() => setRevokeOpen(true)}
                  >
                    <ShieldOff aria-hidden="true" className="mr-2 h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate share link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link will stop working immediately and a new link will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "rotate"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction === "rotate"} onClick={() => void handleRotate()}>
              {pendingAction === "rotate" ? "Rotating…" : "Rotate link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke share link?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone using the current link will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction === "revoke"}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction === "revoke"} onClick={() => void handleRevoke()}>
              {pendingAction === "revoke" ? "Revoking…" : "Revoke link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={fallbackUrl !== null}
        onOpenChange={(open) => {
          if (!open) setFallbackUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy share link</DialogTitle>
            <DialogDescription>
              Clipboard access is unavailable. Copy the link manually, then close this dialog.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={fallbackUrl ?? ""} aria-label="Share link" className="font-mono text-xs" />
          <DialogFooter>
            <Button
              type="button"
              disabled={!fallbackUrl}
              onClick={() => {
                if (!fallbackUrl) return;
                void copyTextToClipboard(fallbackUrl).then((copied) => {
                  if (copied) toast.success("Share link copied");
                });
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function invalidateStaffDocumentShareQuery(
  qc: ReturnType<typeof useQueryClient>,
  staffId: string,
) {
  void qc.invalidateQueries({ queryKey: shareQueryKey(staffId) });
}
