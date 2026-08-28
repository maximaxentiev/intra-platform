import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("centre edit UI refinement", () => {
  const form = () => readSrc("components/CentreForm.tsx");
  const details = () => readSrc("components/centres/CentreDetailsCard.tsx");
  const contacts = () => readSrc("components/CentreContactsEditor.tsx");

  it("removes hourly rate from the active edit UI", () => {
    expect(form()).not.toContain("Hourly Rate");
    expect(form()).not.toContain('id="hourlyRate"');
    expect(details()).not.toContain("Hourly rate");
  });

  it("removes centre intro copy from edit view", () => {
    expect(details()).not.toContain("Centre details");
    expect(details()).not.toContain("Update the centre record.");
  });

  it("removes section category titles from the edit form", () => {
    expect(form()).not.toContain("Centre identity");
    expect(form()).not.toContain("Communication");
    expect(form()).not.toContain("Rules & notes");
    expect(form()).not.toContain("Commercial terms");
  });

  it("removes helper copy for contacts and carer instructions", () => {
    expect(contacts()).not.toContain("Order matters — the first contact is the primary contact.");
    expect(form()).not.toContain(
      "These instructions are shared with carers when they are assigned to shifts at this centre.",
    );
  });

  it("preserves centre field controls and save flow", () => {
    expect(form()).toContain("Centre name");
    expect(form()).toContain("Rules, Policies, and Other Notes");
    expect(form()).toContain("Primary communication channel");
    expect(details()).toContain("CentreForm");
    expect(readSrc("routes/_authenticated/centres.$id.tsx")).toContain("centresApi.update");
    expect(readSrc("routes/_authenticated/centres.$id.tsx")).not.toContain("hourlyRate");
  });

  it("preserves contact ordering behavior", () => {
    expect(contacts()).toContain("reorderContacts");
    expect(contacts()).toContain("isPrimaryContact");
  });
});

describe("staff detail UI refinement", () => {
  const profile = () => readSrc("components/staff/StaffProfileCard.tsx");
  const portal = () => readSrc("components/PortalAccountSection.tsx");

  it("removes read-mode section category titles", () => {
    expect(profile()).not.toContain('label="Identity"');
    expect(profile()).not.toContain('label="Contact"');
    expect(profile()).not.toContain('label="Location"');
    expect(profile()).not.toContain('label="Additional"');
    expect(profile()).not.toContain("ProfileGroup");
  });

  it("keeps Portal account heading and removes the note under it", () => {
    expect(portal()).toContain("Portal account");
    expect(portal()).not.toContain("description={STATE_COPY");
    expect(portal()).not.toContain("Portal account is active.");
    expect(portal()).not.toContain("No carer portal account yet");
  });

  it("preserves staff profile fields and portal controls", () => {
    expect(profile()).toContain("Legal name");
    expect(profile()).toContain("staffApi.update");
    expect(portal()).toContain("sendPortalInvitation");
    expect(portal()).toContain("PortalStatusBadge");
  });
});

describe("staff documents page refinement", () => {
  const section = () => readSrc("components/staff/StaffDocumentsSection.tsx");
  const share = () => readSrc("components/staff/StaffDocumentShareControls.tsx");

  it("shows only shift-matching eligibility in the summary", () => {
    expect(section()).toContain("Eligible for shift matching");
    expect(section()).toContain("Not eligible for shift matching");
    expect(section()).not.toContain("DocumentStatusBadge");
    expect(section()).not.toMatch(/uppercase tracking-wide text-muted-foreground">Documents</);
  });

  it("uses aligned title, status, and action columns without Required/Optional labels", () => {
    expect(section()).toContain("sm:grid-cols-[14rem_11rem_minmax(0,1fr)]");
    expect(section()).toContain("categoryRowStatusLabel");
    expect(section()).not.toMatch(/meta\.required \? "Required" : "Optional"/);
  });

  it("highlights the expanded document row with primary-soft surface", () => {
    expect(section()).toContain('isOpen && "bg-primary-soft"');
  });

  it("places share controls last and removes the active status badge", () => {
    const shareIndex = section().indexOf("StaffDocumentShareControls");
    const alertIndex = section().indexOf("AlertDialog open={approveTarget");
    expect(shareIndex).toBeGreaterThan(-1);
    expect(alertIndex).toBeGreaterThan(shareIndex);
    expect(share()).not.toContain("Share link active");
    expect(share()).toContain("Generate share link");
    expect(share()).toContain("Copy link");
  });
});

describe("staff document status UI refinement", () => {
  const labels = () => readSrc("lib/ops-staff-documents.ts");
  const badge = () => readSrc("components/DocumentStatusBadge.tsx");
  const list = () => readSrc("routes/_authenticated/staff.index.tsx");

  it("replaces Warning with Expiring Soon and Expired", () => {
    expect(labels()).toContain('expiring_soon: "Expiring Soon"');
    expect(labels()).toContain('expired: "Expired"');
    expect(labels()).not.toContain('"warning"');
    expect(badge()).not.toContain("warning:");
    expect(list()).toContain("STAFF_DOCUMENT_FILTER_OPTIONS");
  });
});
