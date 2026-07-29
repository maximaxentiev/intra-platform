// Document review UX — private objects are fetched via the authenticated API
// (see useDocumentContentUrl → GET /api/applications/:id/documents/:docId/content).
import { useCallback, useEffect, useState } from "react";
import { FileText, Image as ImageIcon, FileType2, ExternalLink, Lock, RotateCcw } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acquireDocumentBlobUrl,
  invalidateDocumentBlob,
  releaseDocumentBlob,
} from "@/lib/application-document-content";
import {
  DOCUMENT_LABELS,
  DOCUMENT_SHORT_LABELS,
  fileKind,
  fmtBytes,
  fmtDate,
  type ApplicationDocument,
} from "@/lib/applications";

/** Integration point for secure document retrieval via the NestJS API. */
export function useDocumentContentUrl(doc: ApplicationDocument | null): {
  url: string | null;
  loading: boolean;
  unavailable: boolean;
  retry: () => void;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    if (doc) invalidateDocumentBlob(doc);
    setRetryKey((k) => k + 1);
  }, [doc]);

  useEffect(() => {
    if (!doc) {
      setUrl(null);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    let active = true;
    setLoading(true);
    setUnavailable(false);
    setUrl(null);

    acquireDocumentBlobUrl(doc)
      .then((blobUrl) => {
        if (!active) {
          releaseDocumentBlob(doc);
          return;
        }
        setUrl(blobUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUrl(null);
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      active = false;
      releaseDocumentBlob(doc);
    };
  }, [doc?.applicationId, doc?.id, retryKey]);

  return { url, loading, unavailable, retry };
}

function KindIcon({ doc, className }: { doc: ApplicationDocument; className?: string }) {
  const kind = fileKind(doc);
  const Icon = kind === "image" ? ImageIcon : kind === "word" ? FileType2 : FileText;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}

function PreviewSurface({ doc, tall = false }: { doc: ApplicationDocument; tall?: boolean }) {
  const kind = fileKind(doc);
  const { url, loading, unavailable, retry } = useDocumentContentUrl(doc);

  if (kind === "word") {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-md border border-dashed border-border bg-muted/40 text-center px-4",
          tall ? "min-h-[420px]" : "h-40",
        )}
      >
        <div className="space-y-1">
          <FileType2 className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <div className="text-sm font-medium">Word Document</div>
          <div className="text-xs text-muted-foreground">Preview unavailable</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("animate-pulse rounded-md bg-muted", tall ? "min-h-[420px]" : "h-40")} />
    );
  }

  if (!url || unavailable) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-md border border-dashed border-border bg-muted/40 text-center px-4",
          tall ? "min-h-[420px]" : "h-40",
        )}
      >
        <div className="space-y-2">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden />
          <div className="text-xs font-medium text-foreground">Document preview unavailable.</div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={retry}>
            <RotateCcw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return kind === "image" ? (
    <img
      src={url}
      alt={DOCUMENT_LABELS[doc.category]}
      className={cn("w-full rounded-md object-contain bg-muted", tall ? "max-h-[70vh]" : "h-40")}
    />
  ) : (
    <iframe
      title={DOCUMENT_LABELS[doc.category]}
      src={url}
      className={cn("w-full rounded-md border border-border bg-muted", tall ? "h-[70vh]" : "h-40")}
    />
  );
}

export function DocumentViewerDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: ApplicationDocument | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { url } = useDocumentContentUrl(doc);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        {doc && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">{DOCUMENT_LABELS[doc.category]}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                {doc.originalFilename} · {fmtBytes(doc.byteSize)}
                {doc.uploadedAt ? ` · Uploaded ${fmtDate(doc.uploadedAt)}` : ""}
              </p>
            </DialogHeader>
            <PreviewSurface doc={doc} tall />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" disabled={!url} asChild={!!url}>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Open / Download
                  </a>
                ) : (
                  <span>
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Open / Download
                  </span>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Compact chip with hover/focus preview popover. */
export function DocumentChip({
  doc,
  onOpen,
  full = false,
}: {
  doc: ApplicationDocument;
  onOpen: (doc: ApplicationDocument) => void;
  full?: boolean;
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(doc);
          }}
          className="inline-flex max-w-[10rem] items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KindIcon doc={doc} />
          <span className="truncate">
            {full ? DOCUMENT_LABELS[doc.category] : DOCUMENT_SHORT_LABELS[doc.category]}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 space-y-2" side="top" align="start">
        <div className="min-w-0">
          <div className="text-sm font-medium">{DOCUMENT_LABELS[doc.category]}</div>
          <div className="truncate text-[11px] text-muted-foreground">{doc.originalFilename}</div>
        </div>
        <PreviewSurface doc={doc} />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(doc);
          }}
        >
          Open Full Document
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}

export function DocumentChips({
  docs,
  onOpen,
  max = 3,
}: {
  docs: ApplicationDocument[];
  onOpen: (doc: ApplicationDocument) => void;
  max?: number;
}) {
  if (!docs.length) return <span className="text-muted-foreground/50">—</span>;
  const shown = docs.slice(0, max);
  const rest = docs.length - shown.length;
  return (
    <span className="flex items-center gap-1">
      {shown.map((d) => (
        <DocumentChip key={d.id} doc={d} onOpen={onOpen} />
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground">+{rest}</span>}
    </span>
  );
}

/** Larger document rows used inside the application drawer. */
export function DocumentCard({
  doc,
  onOpen,
}: {
  doc: ApplicationDocument;
  onOpen: (doc: ApplicationDocument) => void;
}) {
  const kind = fileKind(doc);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <KindIcon doc={doc} className="h-4 w-4" />
          {DOCUMENT_LABELS[doc.category]}
        </div>
        <div className="truncate text-xs text-muted-foreground">{doc.originalFilename}</div>
        <div className="text-[11px] text-muted-foreground">
          {kind === "word" ? "Word document" : kind === "image" ? "Image" : kind === "pdf" ? "PDF" : "File"}
          {doc.byteSize ? ` · ${fmtBytes(doc.byteSize)}` : ""}
          {doc.uploadedAt ? ` · ${fmtDate(doc.uploadedAt)}` : ""}
        </div>
      </div>
      <div className="shrink-0">
        <DocumentChip doc={doc} onOpen={onOpen} full={false} />
      </div>
    </div>
  );
}

export function useDocumentViewer() {
  const [doc, setDoc] = useState<ApplicationDocument | null>(null);
  return {
    doc,
    open: (d: ApplicationDocument) => setDoc(d),
    viewer: (
      <DocumentViewerDialog doc={doc} open={!!doc} onOpenChange={(v) => !v && setDoc(null)} />
    ),
  };
}
