import { useCallback, useEffect, useRef, useState } from "react";
import { splitCentreEmailBodySegments } from "@/components/shifts/CentreEmailBodyEditor";
import type {
  CentreEmailBodySegment,
  CentreEmailCustomContent,
  CentreEmailPreview,
} from "@/lib/centre-email-review";

type UseCentreEmailReviewOptions = {
  open: boolean;
  loadPreview: (centreEmail?: CentreEmailCustomContent) => Promise<CentreEmailPreview>;
};

export function useCentreEmailReview({ open, loadPreview }: UseCentreEmailReviewOptions) {
  const [preview, setPreview] = useState<CentreEmailPreview | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segments, setSegments] = useState<CentreEmailBodySegment[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [staleError, setStaleError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await loadPreview();
      setPreview(result);
      setSubject(result.subject);
      setBody(result.body);
      setSegments(result.segments.length > 0 ? result.segments : splitCentreEmailBodySegments(result.body));
      return result;
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Could not load email preview.");
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => {
    if (!open) {
      initialLoadRef.current = false;
      setPreview(null);
      setPreviewError(null);
      setStaleError(null);
      setSubject("");
      setBody("");
      setSegments([]);
      return;
    }
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void refreshPreview();
  }, [open, refreshPreview]);

  function handleBodyChange(next: { body: string; segments: CentreEmailBodySegment[] }) {
    setBody(next.body);
    setSegments(next.segments);
  }

  return {
    preview,
    subject,
    body,
    segments,
    setSubject,
    setBody,
    setSegments,
    handleBodyChange,
    previewLoading,
    previewError,
    staleError,
    setStaleError,
    refreshPreview,
    centreEmailPayload: { subject: subject.trim(), body },
  };
}
