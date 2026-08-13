import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STAFF_DOCUMENT_SHARE_POLICY,
  opsStaffDocumentShareApi,
} from "@/lib/ops-staff-document-share";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("ops staff document share API client", () => {
  it("defines typed lifecycle endpoints", () => {
    expect(typeof opsStaffDocumentShareApi.getStatus).toBe("function");
    expect(typeof opsStaffDocumentShareApi.generate).toBe("function");
    expect(typeof opsStaffDocumentShareApi.copyLink).toBe("function");
    expect(typeof opsStaffDocumentShareApi.rotate).toBe("function");
    expect(typeof opsStaffDocumentShareApi.revoke).toBe("function");
  });
});

describe("ops share UI", () => {
  it("places staff-level share controls in StaffDocumentsSection", () => {
    const sectionSrc = readSrc("components/staff/StaffDocumentsSection.tsx");
    expect(sectionSrc).toContain("StaffDocumentShareControls");
    expect(sectionSrc).not.toContain("Share documents</");
  });

  it("supports none, active, and revoked states with confirmations", () => {
    const controlsSrc = readSrc("components/staff/StaffDocumentShareControls.tsx");
    expect(controlsSrc).toContain("Generate share link");
    expect(controlsSrc).toContain("Share link active");
    expect(controlsSrc).toContain("Copy link");
    expect(controlsSrc).toContain("Rotate share link?");
    expect(controlsSrc).toContain("Revoke share link?");
    expect(controlsSrc).toContain("Share link revoked");
    expect(controlsSrc).toContain("Generate new link");
    expect(controlsSrc).toContain('["staff-document-share", staffId]');
    expect(controlsSrc).toContain("copyLink");
    expect(controlsSrc).not.toMatch(/console\.log|localStorage|sessionStorage/);
  });

  it("shows the expanded public share policy copy", () => {
    expect(STAFF_DOCUMENT_SHARE_POLICY).toContain("Vulnerable Sector Check");
    expect(STAFF_DOCUMENT_SHARE_POLICY).toContain("First Aid & CPR");
    expect(STAFF_DOCUMENT_SHARE_POLICY).toMatch(/Immunizations/i);
    expect(STAFF_DOCUMENT_SHARE_POLICY).toMatch(/COVID-19 Vaccination/i);
    expect(STAFF_DOCUMENT_SHARE_POLICY).toMatch(/only when it is on file and approved/i);
  });

  it("renders canonical policy copy visibly without duplicating sr-only text", () => {
    const controlsSrc = readSrc("components/staff/StaffDocumentShareControls.tsx");
    expect(controlsSrc).toContain("{STAFF_DOCUMENT_SHARE_POLICY}");
    expect(controlsSrc).not.toContain("sr-only");
  });

  it("keeps shareUrl transient and uses POST copy-link", () => {
    const controlsSrc = readSrc("components/staff/StaffDocumentShareControls.tsx");
    expect(controlsSrc).toContain("copyLink");
    expect(controlsSrc).toContain("setFallbackUrl(null)");
    expect(controlsSrc).not.toMatch(/queryKey.*shareUrl|shareUrl.*queryKey/i);
    expect(controlsSrc).not.toMatch(/localStorage|sessionStorage/);
  });
});
