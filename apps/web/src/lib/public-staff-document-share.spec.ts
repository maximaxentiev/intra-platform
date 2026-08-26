import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  PUBLIC_SHARE_EMPTY_MESSAGE,
  PUBLIC_SHARE_UNAVAILABLE_MESSAGE,
  exchangeShareSession,
  getPublicStaffDocuments,
  isPublicShareUnavailableError,
  loadPublicSharePage,
  parseShareTokenFromHash,
  publicStaffDocumentContentPath,
  removeShareTokenFromBrowserUrl,
} from "@/lib/public-staff-document-share";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const sampleMetadata = {
  staff: { legalName: "Jane Doe", role: "ECE" },
  documents: [
    {
      documentType: "vulnerable_sector_check" as const,
      label: "Vulnerable Sector Check",
      processedDate: "2026-08-01",
      expiryDate: "2029-08-01",
      expiryDisplay: "current" as const,
      files: [
        {
          id: "file-1",
          originalFilename: "vsc.pdf",
          contentType: "application/pdf",
        },
      ],
    },
  ],
};

describe("parseShareTokenFromHash", () => {
  it("reads a raw token from the URL fragment", () => {
    expect(parseShareTokenFromHash("#abc123")).toBe("abc123");
    expect(parseShareTokenFromHash("abc123")).toBe("abc123");
    expect(parseShareTokenFromHash("#")).toBeNull();
    expect(parseShareTokenFromHash("")).toBeNull();
  });
});

describe("removeShareTokenFromBrowserUrl", () => {
  it("strips the fragment while preserving the path", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/documents/jane-doe", search: "" },
      history: { state: {}, replaceState },
    });

    removeShareTokenFromBrowserUrl();
    expect(replaceState).toHaveBeenCalledWith({}, "", "/documents/jane-doe");

    vi.unstubAllGlobals();
  });
});

describe("loadPublicSharePage", () => {
  it("exchanges slug + token then loads metadata on fragment flow", async () => {
    const exchange = vi.fn().mockResolvedValue(undefined);
    const getMetadata = vi.fn().mockResolvedValue(sampleMetadata);

    const result = await loadPublicSharePage({
      slug: "jane-doe",
      hash: "#secret-token",
      exchange,
      getMetadata,
    });

    expect(exchange).toHaveBeenCalledWith("jane-doe", "secret-token");
    expect(getMetadata).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "available", metadata: sampleMetadata });
  });

  it("shows unavailable and does not metadata-fallback when exchange fails", async () => {
    const exchange = vi.fn().mockRejectedValue(new ApiError(404, PUBLIC_SHARE_UNAVAILABLE_MESSAGE));
    const getMetadata = vi.fn().mockResolvedValue(sampleMetadata);

    const result = await loadPublicSharePage({
      slug: "bob-smith",
      hash: "#bad-token",
      exchange,
      getMetadata,
    });

    expect(result).toEqual({ status: "unavailable" });
    expect(getMetadata).not.toHaveBeenCalled();
  });

  it("loads metadata directly when no fragment is present", async () => {
    const exchange = vi.fn();
    const getMetadata = vi.fn().mockResolvedValue({ ...sampleMetadata, documents: [] });

    const result = await loadPublicSharePage({
      slug: "jane-doe",
      hash: "",
      exchange,
      getMetadata,
    });

    expect(exchange).not.toHaveBeenCalled();
    expect(result.status).toBe("empty");
  });

  it("returns unavailable when refresh metadata fails with 404", async () => {
    const result = await loadPublicSharePage({
      slug: "jane-doe",
      hash: "",
      exchange: vi.fn(),
      getMetadata: vi.fn().mockRejectedValue(new ApiError(404, PUBLIC_SHARE_UNAVAILABLE_MESSAGE)),
    });

    expect(result).toEqual({ status: "unavailable" });
  });
});

describe("public share API client", () => {
  it("targets the dedicated public endpoints", () => {
    expect(typeof exchangeShareSession).toBe("function");
    expect(typeof getPublicStaffDocuments).toBe("function");
    expect(publicStaffDocumentContentPath("first_aid_cpr", "file-1")).toBe(
      "/v1/public/staff-documents/share/first_aid_cpr/files/file-1/content",
    );
  });

  it("recognizes unavailable API errors", () => {
    expect(isPublicShareUnavailableError(new ApiError(404, PUBLIC_SHARE_UNAVAILABLE_MESSAGE))).toBe(
      true,
    );
    expect(isPublicShareUnavailableError(new ApiError(500, "fail"))).toBe(false);
  });
});

describe("public share page source hygiene", () => {
  it("uses controlled fragment handling and exact public copy", () => {
    const routeSrc = readSrc("routes/documents.$slug.tsx");
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    const libSrc = readSrc("lib/public-staff-document-share.ts");

    expect(routeSrc).toContain('createFileRoute("/documents/$slug")');
    expect(routeSrc).toContain("noindex, nofollow, noarchive");
    expect(routeSrc).toContain("no-referrer");
    expect(routeSrc).not.toContain("AppShell");
    expect(routeSrc).not.toContain("CarerShell");

    expect(libSrc).toContain("parseShareTokenFromHash");
    expect(pageSrc).toContain("window.location.hash");
    expect(pageSrc).toContain("removeShareTokenFromBrowserUrl");
    expect(pageSrc).toContain("PUBLIC_SHARE_EMPTY_MESSAGE");
    expect(pageSrc).toContain("PUBLIC_SHARE_UNAVAILABLE_MESSAGE");
    expect(pageSrc).not.toMatch(/localStorage|sessionStorage|console\.log/);
    expect(pageSrc).not.toMatch(/\bstaffId\b|\bstorageKey\b|\breviewStatus\b|\bissueNote\b/i);
  });

  it("opens files through the public content helper", () => {
    const contentSrc = readSrc("lib/public-staff-document-content.ts");
    expect(contentSrc).toContain("credentials: \"include\"");
    expect(contentSrc).toContain("publicStaffDocumentContentPath");
    expect(contentSrc).toContain("PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE");
    expect(contentSrc).not.toMatch(/storageKey|digitalocean|spaces/i);
  });

  it("renders all backend document categories without two-category assumptions", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    const libSrc = readSrc("lib/public-staff-document-share.ts");

    expect(libSrc).toContain("immunizations");
    expect(libSrc).toContain("covid19_vaccination");
    expect(libSrc).toContain("no_expiry");
    expect(pageSrc).toContain("metadata.documents.map");
    // Centre-facing view intentionally shows only title + file + View document.
    expect(pageSrc).not.toContain("showExpiryDate");
    expect(pageSrc).toContain("View document");
    expect(pageSrc).not.toMatch(/Missing COVID|COVID required|COVID incomplete/i);
  });

  it("uses generic unavailable copy for error and unavailable states", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    expect(pageSrc).toContain('pageState === "unavailable" || pageState === "error"');
    expect(pageSrc).toContain("PUBLIC_SHARE_UNAVAILABLE_MESSAGE");
    expect(pageSrc).not.toMatch(/invalid token|revoked token|rotated token|pending review|issue flagged/i);
    expect(pageSrc).not.toMatch(/Something went wrong/i);
  });

  it("does not persist the share token beyond fragment exchange", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    expect(pageSrc).toContain("removeShareTokenFromBrowserUrl");
    expect(pageSrc).not.toMatch(/useState\(.*token|setToken|localStorage|sessionStorage/i);
    expect(pageSrc).not.toMatch(/location\.hash\s*=|searchParams.*token/i);
  });

  it("labels view buttons for accessibility without exposing internal ids", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    expect(pageSrc).toContain('aria-label={`View document ${file.originalFilename}`}');
    expect(pageSrc).not.toMatch(/\bstaffId\b|\bsubmissionId\b|\bstorageKey\b/i);
  });

  it("shows staff legal name on the centre-facing share page", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    expect(pageSrc).toContain("staff.legalName");
    expect(pageSrc).not.toContain("staff.displayName");
  });

  it("keeps file-open failures local to the file action", () => {
    const pageSrc = readSrc("components/public/PublicDocumentSharePage.tsx");
    expect(pageSrc).toContain("PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE");
    expect(pageSrc).toContain("fileOpenErrors");
    expect(pageSrc).not.toMatch(/openPublicStaffDocumentFile\([\s\S]*?setPageState\("unavailable"\)/);
    expect(pageSrc).not.toMatch(/handleViewFile[\s\S]*?setMetadata\(null\)/);
  });
});
