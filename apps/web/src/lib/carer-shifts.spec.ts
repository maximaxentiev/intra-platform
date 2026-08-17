import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import { carerShiftsApi, type CarerShift } from "@/lib/carer-shifts";
import {
  carerShiftsHistoryQueryKey,
  carerShiftsSummaryQueryKey,
  carerShiftsUpcomingQueryKey,
} from "@/lib/carer-shifts-queries";
import {
  carerShiftStatusLabel,
  carerShiftsRangeLabel,
} from "@/lib/carer-shifts-display";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const sampleShift = (overrides: Partial<CarerShift> = {}): CarerShift => ({
  id: "shift-1",
  shiftDate: "2026-08-25",
  startTime: "08:30",
  endTime: "16:30",
  roleNeeded: "ECE",
  status: "upcoming",
  centre: {
    name: "ABC Child Care Centre",
    address: "123 Main Street",
    city: "Toronto",
  },
  ...overrides,
});

describe("carerShiftsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads summary without staffId", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    await carerShiftsApi.summary();
    expect(api.get).toHaveBeenCalledWith("/staff-portal/shifts/summary", { limit: 3 });
  });

  it("loads summary with optional limit", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    await carerShiftsApi.summary(5);
    expect(api.get).toHaveBeenCalledWith("/staff-portal/shifts/summary", { limit: 5 });
  });

  it("loads upcoming with pagination query params", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
    await carerShiftsApi.upcoming(2, 25);
    expect(api.get).toHaveBeenCalledWith("/staff-portal/shifts/upcoming", {
      page: 2,
      pageSize: 25,
    });
  });

  it("loads history with pagination query params", async () => {
    vi.mocked(api.get).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
    await carerShiftsApi.history(1, 10);
    expect(api.get).toHaveBeenCalledWith("/staff-portal/shifts/history", {
      page: 1,
      pageSize: 10,
    });
  });

  it("loads shift detail by id without staffId", async () => {
    vi.mocked(api.get).mockResolvedValue(sampleShift());
    await carerShiftsApi.get("shift-1");
    expect(api.get).toHaveBeenCalledWith("/staff-portal/shifts/shift-1");
  });
});

describe("carer shift query keys", () => {
  it("uses stable query keys for summary, upcoming, and history", () => {
    expect(carerShiftsSummaryQueryKey()).toEqual(["carer-shifts-summary", 3]);
    expect(carerShiftsUpcomingQueryKey(1, 10)).toEqual(["carer-shifts-upcoming", 1, 10]);
    expect(carerShiftsHistoryQueryKey(2, 25)).toEqual(["carer-shifts-history", 2, 25]);
  });
});

describe("carer shift display helpers", () => {
  it("maps API statuses to Carer-facing labels", () => {
    expect(carerShiftStatusLabel("upcoming")).toBe("Upcoming");
    expect(carerShiftStatusLabel("today")).toBe("Today");
    expect(carerShiftStatusLabel("completed")).toBe("Completed");
    expect(carerShiftStatusLabel("cancelled")).toBe("Cancelled");
  });

  it("formats pagination range labels", () => {
    expect(
      carerShiftsRangeLabel({ page: 1, pageSize: 10, totalItems: 24 }),
    ).toBe("Showing 1–10 of 24 shifts");
    expect(carerShiftsRangeLabel(undefined)).toBeNull();
  });
});

describe("carer shifts dashboard", () => {
  it("replaces static placeholder with live summary component", () => {
    const home = readSrc("routes/carer/index.tsx");
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(home).toContain("CarerShiftsDashboardSummary");
    expect(home).not.toContain("Your assigned shifts will appear here.");
    expect(dashboard).toContain("useCarerShiftsSummary(3)");
  });

  it("renders date, time, centre, optional role, and cancelled status", () => {
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(dashboard).toContain("formatDashboardAvailabilityDateLabel");
    expect(dashboard).toContain("formatAvailabilityWindowDisplay");
    expect(dashboard).toContain("shift.centre.name");
    expect(dashboard).toContain("shift.roleNeeded");
    expect(dashboard).toContain("carerShiftStatusLabel");
    expect(dashboard).toContain("CARER_SHIFT_STATUS_TONE");
  });

  it("shows empty state and View all shifts link", () => {
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(dashboard).toContain("No upcoming shifts assigned.");
    expect(dashboard).toContain('to="/carer/shifts"');
    expect(dashboard).toContain("View all shifts");
  });

  it("handles summary failure without crashing portal home", () => {
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(dashboard).toContain("Unable to load upcoming shifts.");
    expect(dashboard).toContain("Retry");
  });
});

describe("carer shifts page", () => {
  it("is protected by requireCarerSessionForPortal", () => {
    const route = readSrc("routes/carer/shifts.tsx");
    expect(route).toContain("requireCarerSessionForPortal");
    expect(route).toContain("CarerShiftsManager");
    expect(route).toContain("Back to portal");
  });

  it("defaults to upcoming tab with lazy history query", () => {
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    const queries = readSrc("lib/carer-shifts-queries.ts");
    expect(manager).toContain('useState<ShiftsTab>("upcoming")');
    expect(manager).toContain('role="tablist"');
    expect(manager).toContain("Upcoming");
    expect(manager).toContain("History");
    expect(manager).toContain('tab === "history" && isActive');
    expect(queries).toContain("enabled");
  });

  it("uses upcoming and history endpoints with separate pagination state", () => {
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    expect(manager).toContain("useCarerShiftsUpcoming");
    expect(manager).toContain("useCarerShiftsHistory");
    expect(manager).toContain("useState<CarerShiftPageSize>(10)");
    expect(manager).toContain("useState<CarerShiftPageSize>(25)");
    expect(manager).toContain("setUpcomingPage(1)");
    expect(manager).toContain("setHistoryPage(1)");
  });

  it("renders shift cards without internal fields or action buttons", () => {
    const card = readSrc("components/carer/CarerShiftCard.tsx");
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    expect(card).toContain("formatDashboardAvailabilityDateLabel");
    expect(card).toContain("formatAvailabilityWindowDisplay");
    expect(card).toContain("carerShiftStatusLabel");
    expect(card).toContain("shift.roleNeeded");
    expect(card).not.toContain("assignedStaffId");
    expect(card).not.toContain("cancellationReason");
    expect(manager).not.toMatch(/\bAccept\b/);
    expect(manager).not.toMatch(/\bDecline\b/);
    expect(manager).not.toMatch(/\bCancel shift\b/);
    expect(manager).not.toMatch(/\bClaim\b/);
    expect(manager).not.toMatch(/\bCheck in\b/);
  });

  it("does not create a shift detail route", () => {
    const card = readSrc("components/carer/CarerShiftCard.tsx");
    const route = readSrc("routes/carer/shifts.tsx");
    expect(card).not.toContain("/carer/shifts/$");
    expect(route).not.toContain("shifts/$id");
  });

  it("shows empty and error states for both tabs", () => {
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    expect(manager).toContain("No upcoming shifts assigned.");
    expect(manager).toContain("No previous shifts yet.");
    expect(manager).toContain("Unable to load shifts.");
    expect(manager).toContain("Try again");
  });
});

describe("carer shifts read-only security", () => {
  it("contains no carer shift action buttons in UI source", () => {
    const sources = [
      "components/carer/CarerShiftsDashboardSummary.tsx",
      "components/carer/CarerShiftsManager.tsx",
      "components/carer/CarerShiftCard.tsx",
      "routes/carer/shifts.tsx",
      "routes/carer/index.tsx",
    ];
    const forbidden = [
      "Accept shift",
      "Decline shift",
      "Cancel shift",
      "Confirm shift",
      "Check in",
      "Check out",
      "Claim shift",
    ];
    for (const rel of sources) {
      const src = readSrc(rel);
      for (const phrase of forbidden) {
        expect(src).not.toContain(phrase);
      }
    }
  });

  it("does not recalculate shift status in the web layer", () => {
    const card = readSrc("components/carer/CarerShiftCard.tsx");
    const display = readSrc("lib/carer-shifts-display.ts");
    expect(card).toContain("shift.status");
    expect(display).not.toContain("torontoToday");
    expect(display).not.toContain("new Date(");
  });
});

describe("carer shifts onboarding isolation", () => {
  it("does not modify onboarding routes", () => {
    const onboarding = readSrc("routes/carer/onboarding/index.tsx");
    expect(onboarding).not.toContain("CarerShifts");
    expect(onboarding).not.toContain("carer-shifts");
  });
});
