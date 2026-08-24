import { describe, expect, it } from "vitest";
import {
  centreLocationLabel,
  centreLocationOrFallback,
  centrePrimaryContactLabel,
  centreResultCountLabel,
  centreShiftAssignedLabel,
  contactDetailLines,
  contactDisplayName,
  contactDraftHasContent,
  filterCentresByName,
  isPrimaryContact,
  reorderedContactIds,
  secondaryChannelsLabel,
  withoutPrimaryChannel,
} from "./centres-ui";

describe("filterCentresByName", () => {
  const list = [{ name: "Bright Start" }, { name: "little acorns" }];

  it("returns everything for an empty query", () => {
    expect(filterCentresByName(list, "   ")).toHaveLength(2);
  });

  it("matches case-insensitively on name only", () => {
    expect(filterCentresByName(list, "ACORN")).toEqual([{ name: "little acorns" }]);
  });
});

describe("centreResultCountLabel", () => {
  it("reports the filtered and total counts", () => {
    expect(centreResultCountLabel(2, 9)).toBe("Showing 2 of 9 centres");
  });
});

describe("centreLocationLabel", () => {
  it("returns null when nothing is on file", () => {
    expect(centreLocationLabel("", null)).toBeNull();
  });

  it("joins address and city", () => {
    expect(centreLocationLabel("12 King St", "Toronto")).toBe("12 King St, Toronto");
  });

  it("does not repeat a city already in the address", () => {
    expect(centreLocationLabel("12 King St, Toronto", "Toronto")).toBe("12 King St, Toronto");
  });

  it("falls back to a quiet message", () => {
    expect(centreLocationOrFallback(null, null)).toBe("No location on file");
  });
});

describe("contact presentation", () => {
  it("treats only the first contact as primary", () => {
    expect(isPrimaryContact(0)).toBe(true);
    expect(isPrimaryContact(1)).toBe(false);
  });

  it("falls back when a contact has no name", () => {
    expect(contactDisplayName({ name: "  " })).toBe("Unnamed contact");
  });

  it("lists only non-empty detail lines", () => {
    expect(contactDetailLines({ email: "a@b.co", phone: "" })).toEqual(["a@b.co"]);
  });

  it("requires at least one field before a new contact can be saved", () => {
    expect(
      contactDraftHasContent({ name: "", title: "", email: "", phone: "" }),
    ).toBe(false);
    expect(
      contactDraftHasContent({ name: "Alex", title: "", email: "", phone: "" }),
    ).toBe(true);
  });

  it("returns the full ordered id array when reordering", () => {
    const contacts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderedContactIds(contacts, 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("refuses to move past the list bounds", () => {
    expect(reorderedContactIds([{ id: "a" }], 0, 1)).toBeNull();
  });
});

describe("channels", () => {
  it("labels secondary channels or says None", () => {
    expect(secondaryChannelsLabel(["whatsapp", "goto"])).toBe("WhatsApp, GoTo");
    expect(secondaryChannelsLabel([])).toBe("None");
  });

  it("never keeps the primary channel as secondary", () => {
    expect(withoutPrimaryChannel(["email", "goto"], "email")).toEqual(["goto"]);
  });
});

describe("centreShiftAssignedLabel", () => {
  it("says Needs staff only for pending unassigned shifts", () => {
    expect(
      centreShiftAssignedLabel({
        assignedStaffId: null,
        assignedLegalName: null,
        assignedDisplayName: null,
        assignedUseDisplayName: null,
        status: "pending",
      }),
    ).toBe("Needs staff");
    expect(
      centreShiftAssignedLabel({
        assignedStaffId: null,
        assignedLegalName: null,
        assignedDisplayName: null,
        assignedUseDisplayName: null,
        status: "cancelled",
      }),
    ).toBe("Unassigned");
  });

  it("respects the display-name preference", () => {
    expect(
      centreShiftAssignedLabel({
        assignedStaffId: "s1",
        assignedLegalName: "Jane Doe",
        assignedDisplayName: "Janey",
        assignedUseDisplayName: true,
        status: "filled",
      }),
    ).toBe("Janey");
  });
});

describe("centrePrimaryContactLabel", () => {
  it("falls back when no contact exists", () => {
    expect(centrePrimaryContactLabel({ primaryContactName: "" })).toBe("No primary contact");
  });
});
