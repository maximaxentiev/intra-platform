import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

const list = read("routes/_authenticated/staff.index.tsx");
const detail = read("routes/_authenticated/staff.$id.tsx");
const profile = read("components/staff/StaffProfileCard.tsx");
const staffForm = read("components/StaffForm.tsx");
const portal = read("components/PortalAccountSection.tsx");
const centres = read("components/staff/StaffCentrePreferences.tsx");
const shifts = read("components/staff/StaffShiftsTab.tsx");
const summary = read("components/staff/StaffOperationalSummary.tsx");
const availability = read("components/AvailabilityEditor.tsx");

describe("staff list redesign", () => {
  it("keeps live client-side filtering without Apply or URL search", () => {
    expect(list).toContain("filterStaffList");
    expect(list).not.toContain("validateSearch");
    expect(list).not.toContain("Apply filters");
    expect(list).toContain('queryKey: ["staff-list"]');
  });

  it("uses filter chips and distinguishes API error from empty results", () => {
    expect(list).toContain("FilterChipBar");
    expect(list).toContain("buildStaffFilterChips");
    expect(list).toContain("{isError ? (");
    expect(list).toContain("Staff directory could not be loaded");
    expect(list).toMatch(/\{isError \? \([\s\S]*?\) : \([\s\S]*emptyState/);
  });

  it("combines contact and uses row navigation without a View button", () => {
    expect(list).toContain("staffContactLines");
    expect(list).toContain("after:absolute after:inset-0");
    expect(list).not.toContain(">View<");
  });
});

describe("staff detail redesign", () => {
  it("keeps local Radix tabs without URL tab param", () => {
    expect(detail).not.toContain("validateSearch");
    expect(detail).not.toContain("searchSchema");
    expect(detail).toContain('defaultValue="profile"');
  });

  it("loads operational summary from server documentStatus only", () => {
    expect(summary).toContain("documentStatus");
    expect(summary).not.toMatch(/deriveStaff|shiftEligible|compliant|readyFor/i);
    expect(detail).toContain("documentsQ.data?.documentStatus");
  });

  it("uses read-first profile with StaffForm edit mode", () => {
    expect(profile).toContain("StaffForm");
    expect(profile).toContain('setEditing(false)');
    expect(profile).toContain("PropertyList");
    expect(profile).toContain("staffApi.update");
  });

  it("does not show legacy Documents link in read mode", () => {
    expect(profile).not.toContain("Documents link");
    expect(profile).not.toContain("safeDocumentHref");
    expect(profile).not.toContain("Open compliance documents");
  });

  it("does not show legacy Documents link input in edit mode", () => {
    expect(staffForm).not.toContain("Documents link");
    expect(staffForm).not.toContain("documentsUrl");
    expect(staffForm).not.toContain('id="docs"');
  });

  it("omits Display name in read mode when useDisplayName is false", () => {
    expect(profile).toContain("staff.useDisplayName");
    expect(profile).toContain('label: "Display name", value: staff.displayName');
    expect(profile).toContain(": []),");
    expect(profile).not.toMatch(/useDisplayName \? staff\.displayName : ""/);
  });

  it("moves delete into overflow with ConfirmDestructiveDialog", () => {
    expect(detail).toContain('aria-label="More staff actions"');
    expect(detail).toContain("ConfirmDestructiveDialog");
    expect(detail).toContain("DropdownMenuItem");
    expect(detail).not.toMatch(/PageHeader[\s\S]*AlertDialogTrigger[\s\S]*Delete staff/);
  });
});

describe("portal account presentation", () => {
  it("preserves invitation lifecycle endpoints and confirmations", () => {
    expect(portal).toContain("sendPortalInvitation");
    expect(portal).toContain("disablePortalAccess");
    expect(portal).toContain("enablePortalAccess");
    expect(portal).toContain("AlertDialog");
    expect(portal).toContain('status === "no_account"');
    expect(portal).toContain('status === "disabled"');
  });
});

describe("centre preferences contract", () => {
  it("sends full replacement arrays via onChange", () => {
    expect(centres).toContain("selectedIds.filter");
    expect(centres).toContain("[...selectedIds, id]");
    expect(centres).toContain("excludeIds");
    expect(detail).toContain("setTopCentres");
    expect(detail).toContain("setBannedCentres");
  });

  it("uses staff member terminology in preference copy", () => {
    expect(detail).toContain("matching this staff member to shifts");
    expect(detail).toContain("This staff member will not be matched to shifts at these centres.");
    expect(detail).not.toContain("matching this carer to shifts");
    expect(detail).not.toContain("This carer will not be matched");
  });
});

describe("availability desktop layout", () => {
  it("fits seven day columns at wide desktop while keeping horizontal scroll on smaller widths", () => {
    expect(availability).toContain("overflow-x-auto");
    expect(availability).toContain("xl:overflow-x-visible");
    expect(availability).toContain("xl:grid-cols-7");
    expect(availability).toContain("min-w-max");
    expect(availability).toContain("xl:min-w-0");
  });
});

describe("staff shifts tab", () => {
  it("uses staff shifts API with table navigation and error state", () => {
    expect(shifts).toContain("staffApi.shifts");
    expect(shifts).toContain('to="/shifts/$id"');
    expect(shifts).toContain("Assigned shifts could not be loaded");
    expect(shifts).not.toMatch(/hours|utilization|pagination/i);
  });
});
