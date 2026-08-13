import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDocumentDate, expiryDisplayLabel } from "@/lib/carer-documents";
import { openPublicStaffDocumentFile } from "@/lib/public-staff-document-content";
import {
  PUBLIC_SHARE_EMPTY_MESSAGE,
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  exchangeShareSession,
  getPublicStaffDocuments,
  loadPublicSharePage,
  parseShareTokenFromHash,
  removeShareTokenFromBrowserUrl,
  type PublicStaffDocumentShareDocument,
  type PublicStaffDocumentShareMetadata,
} from "@/lib/public-staff-document-share";
import { cn } from "@/lib/utils";

type PageState = "initializing" | "available" | "empty" | "unavailable" | "error";

function publicStatusBadge(document: PublicStaffDocumentShareDocument): string {
  if (document.documentType === "covid19_vaccination") {
    return "Optional";
  }
  if (document.expiryDisplay === "no_expiry") {
    return "Current";
  }
  return expiryDisplayLabel(document.expiryDisplay) ?? "Current";
}

function showProcessedDate(document: PublicStaffDocumentShareDocument): boolean {
  return document.processedDate !== null;
}

function showExpiryDate(document: PublicStaffDocumentShareDocument): boolean {
  return document.expiryDate !== null;
}

export function PublicDocumentSharePage({ slug }: { slug: string }) {
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [metadata, setMetadata] = useState<PublicStaffDocumentShareMetadata | null>(null);
  const [viewingFileKey, setViewingFileKey] = useState<string | null>(null);
  const loadStarted = useRef(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    let cancelled = false;

    async function load() {
      const tokenFromHash = parseShareTokenFromHash(window.location.hash);
      if (tokenFromHash) {
        removeShareTokenFromBrowserUrl();
      }

      const result = await loadPublicSharePage({
        slug,
        hash: tokenFromHash ? `#${tokenFromHash}` : "",
        exchange: exchangeShareSession,
        getMetadata: getPublicStaffDocuments,
      });

      if (cancelled) return;

      if (result.status === "available" || result.status === "empty") {
        setMetadata(result.metadata);
        setPageState(result.status);
        return;
      }

      setMetadata(null);
      setPageState(result.status);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handleViewFile(
    documentType: PublicStaffDocumentShareDocument["documentType"],
    fileId: string,
  ) {
    const key = `${documentType}:${fileId}`;
    setViewingFileKey(key);
    try {
      await openPublicStaffDocumentFile({ documentType, fileId });
    } catch {
      setPageState("unavailable");
      setMetadata(null);
    } finally {
      setViewingFileKey((current) => (current === key ? null : current));
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 text-center">
          <div
            aria-hidden="true"
            className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm"
          >
            IN
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Intra
          </p>
        </header>

        <main aria-live="polite" aria-busy={pageState === "initializing"} className="min-w-0">
          {pageState === "initializing" ? (
            <section className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
              <Loader2 aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading shared documents…</p>
            </section>
          ) : null}

          {pageState === "unavailable" ? (
            <section className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold tracking-tight">{PUBLIC_SHARE_UNAVAILABLE_MESSAGE}</h1>
            </section>
          ) : null}

          {pageState === "error" ? (
            <section className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold tracking-tight">{PUBLIC_SHARE_UNAVAILABLE_MESSAGE}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Something went wrong while loading this page. Please try again later.
              </p>
            </section>
          ) : null}

          {pageState === "empty" && metadata ? (
            <section className="space-y-6">
              <StaffIdentity staff={metadata.staff} />
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm text-muted-foreground">{PUBLIC_SHARE_EMPTY_MESSAGE}</p>
              </div>
            </section>
          ) : null}

          {pageState === "available" && metadata ? (
            <section className="space-y-6">
              <StaffIdentity staff={metadata.staff} />
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Current compliance documents
                </h2>
                <ul className="mt-3 space-y-4">
                  {metadata.documents.map((document) => (
                    <li
                      key={document.documentType}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <article aria-labelledby={`doc-${document.documentType}-title`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3
                            id={`doc-${document.documentType}-title`}
                            className="text-base font-semibold text-foreground"
                          >
                            {document.label}
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-medium",
                              document.expiryDisplay === "expiring_soon"
                                ? "bg-warning/15 text-warning"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {publicStatusBadge(document)}
                          </span>
                        </div>

                        <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                          {showProcessedDate(document) ? (
                            <div className="flex flex-wrap gap-x-2">
                              <dt>Processed:</dt>
                              <dd>{formatDocumentDate(document.processedDate!)}</dd>
                            </div>
                          ) : null}
                          {showExpiryDate(document) ? (
                            <div className="flex flex-wrap gap-x-2">
                              <dt>Expires:</dt>
                              <dd>{formatDocumentDate(document.expiryDate!)}</dd>
                            </div>
                          ) : null}
                        </dl>

                        <ul className="mt-4 space-y-3">
                          {document.files.map((file) => {
                            const fileKey = `${document.documentType}:${file.id}`;
                            const isViewing = viewingFileKey === fileKey;
                            return (
                              <li
                                key={file.id}
                                className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <p className="min-w-0 break-words text-sm font-medium text-foreground">
                                  {file.originalFilename}
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11 shrink-0 self-start sm:self-auto"
                                  disabled={isViewing}
                                  onClick={() => void handleViewFile(document.documentType, file.id)}
                                >
                                  {isViewing ? (
                                    <>
                                      <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                                      Opening…
                                    </>
                                  ) : (
                                    "View document"
                                  )}
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </main>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Documents provided by Intra for verification purposes.
        </footer>
      </div>
    </div>
  );
}

function StaffIdentity({
  staff,
}: {
  staff: PublicStaffDocumentShareMetadata["staff"];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{staff.displayName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{staff.role}</p>
    </div>
  );
}
