import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const list = read("routes/_authenticated/centres.index.tsx");
const detail = read("routes/_authenticated/centres.$id.tsx");
const createRoute = read("routes/_authenticated/centres.new.tsx");
const detailsCard = read("components/centres/CentreDetailsCard.tsx");
const contacts = read("components/CentreContactsEditor.tsx");
const staffPrefs = read("components/centres/CentreStaffPreferences.tsx");
const shifts = read("components/centres/CentreShiftsTab.tsx");

describe("centres list redesign", () => {
  it("keeps live name-only search without URL search state", () => {
    expect(list).toContain("filterCentresByName");
    expect(list).not.toContain("validateSearch");
    expect(list).toContain('queryKey: ["centres"]');
  });

  it("distinguishes API error from empty results", () => {
    expect(list).toContain("{isError ? (");
    expect(list).toContain("Centre directory could not be loaded");
  });

  it("uses desktop table columns and row navigation overlay", () => {
    expect(list).toContain("Primary contact");
    expect(list).toContain("Preferred channel");
    expect(list).toContain("after:absolute after:inset-0");
  });
});

describe("centre detail redesign", () => {
  it("keeps URL tab schema with staff-lists value", () => {
    expect(detail).toContain('"staff-lists"');
    expect(detail).toContain("Staff preferences");
    expect(detail).not.toContain("staff-preferences");
  });

  it("preserves two-step centre save", () => {
    expect(detail).toContain("centresApi.update");
    expect(detail).toContain("saveCentreSecondaryChannels");
  });

  it("uses read-first details and delete overflow", () => {
    expect(detailsCard).toContain("CentreForm");
    expect(detailsCard).toContain("setEditing(false)");
    expect(detail).toContain('aria-label="More centre actions"');
    expect(detail).toContain("ConfirmDestructiveDialog");
  });
});

describe("centre contacts redesign", () => {
  it("derives primary from ordering and keeps blur-save", () => {
    expect(contacts).toContain("isPrimaryContact(index)");
    expect(contacts).not.toMatch(/isPrimary\s*[:=]/);
    expect(contacts).toContain("onBlur={(e) => updateContact");
    expect(contacts).toContain("reorderContacts");
    expect(contacts).toContain("Done");
  });
});

describe("centre staff preferences", () => {
  it("sends full replacement arrays via onChange", () => {
    expect(staffPrefs).toContain("selectedIds.filter");
    expect(staffPrefs).toContain("[...selectedIds, id]");
    expect(staffPrefs).toContain("excludeIds");
    expect(detail).toContain("setTopStaff");
    expect(detail).toContain("setBannedStaff");
  });
});

describe("centre shifts tab", () => {
  it("uses centre shifts API with table navigation and error state", () => {
    expect(shifts).toContain("centresApi.shifts");
    expect(shifts).toContain('to="/shifts/$id"');
    expect(shifts).toContain("Shifts could not be loaded");
    expect(shifts).not.toMatch(/pagination|utilization|hours total/i);
  });
});

describe("add centre", () => {
  it("creates centre then saves secondary channels and redirects to staff-lists", () => {
    expect(createRoute).toContain('submitLabel="Create centre"');
    expect(createRoute).toContain("saveCentreSecondaryChannels");
    expect(createRoute).toContain('tab: "staff-lists"');
  });
});
