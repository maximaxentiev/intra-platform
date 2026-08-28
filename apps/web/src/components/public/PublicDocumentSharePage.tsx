import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntraAuthLogo } from "@/components/auth/IntraAuthLogo";
import { openPublicStaffDocumentFile } from "@/lib/public-staff-document-content";
import {
  PUBLIC_SHARE_EMPTY_MESSAGE,
  PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE,
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  exchangeShareSession,
  getPublicStaffDocuments,
  loadPublicSharePage,
  parseShareTokenFromHash,
  removeShareTokenFromBrowserUrl,
  type PublicStaffDocumentShareDocument,
  type PublicStaffDocumentShareMetadata,
} from "@/lib/public-staff-document-share";

type PageState = "initializing" | "available" | "empty" | "unavailable" | "error";

export function PublicDocumentSharePage({ slug }: { slug: string }) {
  const [pageState, setPageState] = useState<PageState>("initializing");
  const [metadata, setMetadata] = useState<PublicStaffDocumentShareMetadata | null>(null);
  const [viewingFileKey, setViewingFileKey] = useState<string | null>(null);
  const [fileOpenErrors, setFileOpenErrors] = useState<Record<string, true>>({});
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
    setFileOpenErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    try {
      await openPublicStaffDocumentFile({ documentType, fileId });
    } catch {
      setFileOpenErrors((current) => ({ ...current, [key]: true }));
    } finally {
      setViewingFileKey((current) => (current === key ? null : current));
    }
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-col items-center text-center">
          <IntraAuthLogo size="sm" className="h-11 w-11" />
          <p className="mt-3 text-sm font-semibold text-foreground">Intra</p>
        </header>

        <main aria-live="polite" aria-busy={pageState === "initializing"} className="min-w-0 flex-1">
          {pageState === "initializing" ? (
            <section className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
              <Loader2 aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Loading shared documents…</p>
            </section>
          ) : null}

          {pageState === "unavailable" || pageState === "error" ? (
            <section className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                {PUBLIC_SHARE_UNAVAILABLE_MESSAGE}
              </h1>
            </section>
          ) : null}

          {pageState === "empty" && metadata ? (
            <section className="space-y-5">
              <StaffIdentity staff={metadata.staff} />
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">{PUBLIC_SHARE_EMPTY_MESSAGE}</p>
              </div>
            </section>
          ) : null}

          {pageState === "available" && metadata ? (
            <section className="space-y-5">
              <StaffIdentity staff={metadata.staff} />

              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Verified staff documents
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Current approved documents provided by Intra for verification purposes.
                </p>
              </div>

              <ul className="space-y-4">
                {metadata.documents.map((document) => (
                  <li
                    key={document.documentType}
                    className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <article aria-labelledby={`doc-${document.documentType}-title`} className="p-5">
                      <h3
                        id={`doc-${document.documentType}-title`}
                        className="min-w-0 text-base font-semibold leading-tight text-foreground"
                      >
                        {document.label}
                      </h3>

                      <ul className="mt-4 divide-y divide-border/70 rounded-xl border border-border/70">
                          {document.files.map((file) => {
                            const fileKey = `${document.documentType}:${file.id}`;
                            const isViewing = viewingFileKey === fileKey;
                            const fileOpenFailed = fileOpenErrors[fileKey] === true;
                            return (
                              <li key={file.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                  <FileText
                                    aria-hidden="true"
                                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                  />
                                  <div className="min-w-0">
                                    <p className="min-w-0 break-words text-sm leading-snug text-foreground">
                                      {file.originalFilename}
                                    </p>
                                    {fileOpenFailed ? (
                                      <p className="mt-1 text-xs text-destructive">
                                        {PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full shrink-0 sm:w-auto"
                                disabled={isViewing}
                                aria-label={`View document ${file.originalFilename}`}
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
            </section>
          ) : null}
        </main>

        <footer className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Documents provided by Intra for verification purposes.</span>
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
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground">
        {staff.legalName}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{staff.role}</p>
    </div>
  );
}
