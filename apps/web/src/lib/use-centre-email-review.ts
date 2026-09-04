import { useCallback, useEffect, useRef, useState } from "react";
import type { CentreEmailCustomContent, CentreEmailPreview } from "@/lib/centre-email-review";

type UseCentreEmailReviewOptions = {
  open: boolean;
  loadPreview: (centreEmail?: CentreEmailCustomContent) => Promise<CentreEmailPreview>;
};

export function useCentreEmailReview({ open, loadPreview }: UseCentreEmailReviewOptions) {
  const [preview, setPreview] = useState<CentreEmailPreview | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);

  const refreshPreview = useCallback(
    async (next?: CentreEmailCustomContent) => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await loadPreview(next);
        setPreview(result);
        if (!next?.subject && !next?.message) {
          setSubject(result.subject);
          setMessage(result.message);
        }
        return result;
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "Could not load email preview.");
        return null;
      } finally {
        setPreviewLoading(false);
      }
    },
    [loadPreview],
  );

  useEffect(() => {
    if (!open) {
      initialLoadRef.current = false;
      setPreview(null);
      setPreviewError(null);
      setStaleError(null);
      return;
    }
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void refreshPreview();
  }, [open, refreshPreview]);

  useEffect(() => {
    if (!open || !initialLoadRef.current) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void refreshPreview({ subject, message });
    }, 400);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [subject, message, open, refreshPreview]);

  return {
    preview,
    subject,
    message,
    setSubject,
    setMessage,
    previewLoading,
    previewError,
    staleError,
    setStaleError,
    refreshPreview,
    centreEmailPayload: { subject: subject.trim(), message },
  };
}
