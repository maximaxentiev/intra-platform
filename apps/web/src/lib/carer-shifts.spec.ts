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
  carerShiftDetailQueryKey,
  carerShiftsSummaryQueryKey,
  carerShiftsUpcomingQueryKey,
} from "@/lib/carer-shifts-queries";
import {
  carerShiftDetailLinkLabel,
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

  it("does not expose a carer shift cancel client method", () => {
    expect("cancel" in carerShiftsApi).toBe(false);
  });
});

describe("carer shift query keys", () => {
  it("uses stable query keys for summary, upcoming, history, and detail", () => {
    expect(carerShiftsSummaryQueryKey()).toEqual(["carer-shifts-summary", 3]);
    expect(carerShiftsUpcomingQueryKey(1, 10)).toEqual(["carer-shifts-upcoming", 1, 10]);
    expect(carerShiftsHistoryQueryKey(2, 25)).toEqual(["carer-shifts-history", 2, 25]);
    expect(carerShiftDetailQueryKey("shift-1")).toEqual(["carer-shift", "shift-1"]);
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

  it("builds accessible detail link labels", () => {
    expect(carerShiftDetailLinkLabel({ shiftDate: "2026-08-25" })).toContain(
      "View details for",
    );
    expect(carerShiftDetailLinkLabel({ shiftDate: "2026-08-25" })).toContain("2026");
  });
});

describe("carer shifts dashboard", () => {
  it("replaces static placeholder with live summary component", () => {
    const home = readSrc("routes/carer/index.tsx");
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(home).toContain("CarerShiftsDashboardSummary");
    expect(home).not.toContain("Your assigned shifts will appear here.");
    expect(dashboard).toContain("useCarerShiftsSummary(4)");
  });

  it("renders centre, date, and time without redundant upcoming status badges", () => {
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(dashboard).toContain("formatDashboardAvailabilityDateLabel");
    expect(dashboard).toContain("formatAvailabilityWindowDisplay");
    expect(dashboard).toContain("shift.centre.name");
    expect(dashboard).not.toContain("CarerShiftStatusBadge");
  });

  it("shows empty state, clickable cards, and View more shifts link", () => {
    const dashboard = readSrc("components/carer/CarerShiftsDashboardSummary.tsx");
    expect(dashboard).toContain("No upcoming shifts assigned.");
    expect(dashboard).toContain('to="/carer/shifts/$id"');
    expect(dashboard).not.toContain("View shift details");
    expect(dashboard).toContain('to="/carer/shifts"');
    expect(dashboard).toContain("View more shifts");
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
    expect(route).toContain("<Outlet />");
  });

  it("renders the list page at /carer/shifts/", () => {
    const route = readSrc("routes/carer/shifts.index.tsx");
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

  it("renders compact clickable shift cards without list cancel actions", () => {
    const card = readSrc("components/carer/CarerShiftCard.tsx");
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    expect(card).toContain("formatDashboardAvailabilityDateLabel");
    expect(card).toContain("formatAvailabilityWindowDisplay");
    expect(card).toContain("carerShiftShowsStatusBadge");
    expect(card).toContain("shift.centre.name");
    expect(card).toContain('to="/carer/shifts/$id"');
    expect(card).not.toContain("View details");
    expect(card).not.toContain("shift.roleNeeded");
    expect(card).not.toContain("assignedStaffId");
    expect(card).not.toContain("cancellationReason");
    expect(manager).not.toMatch(/\bAccept\b/);
    expect(manager).not.toMatch(/\bDecline\b/);
    expect(manager).not.toMatch(/\bCancel shift\b/);
    expect(manager).not.toMatch(/\bClaim\b/);
    expect(manager).not.toMatch(/\bCheck in\b/);
  });

  it("shows empty and error states for both tabs", () => {
    const manager = readSrc("components/carer/CarerShiftsManager.tsx");
    expect(manager).toContain("No upcoming shifts assigned.");
    expect(manager).toContain("No previous shifts yet.");
    expect(manager).toContain("Unable to load shifts.");
    expect(manager).toContain("Try again");
  });
});

describe("carer shift detail route", () => {
  it("registers /carer/shifts/$id with portal guard architecture", () => {
    const layout = readSrc("routes/carer/shifts.tsx");
    const detailRoute = readSrc("routes/carer/shifts.$id.tsx");
    expect(layout).toContain("requireCarerSessionForPortal");
    expect(detailRoute).toContain('createFileRoute("/carer/shifts/$id")');
    expect(detailRoute).toContain("CarerShiftDetail");
  });

  it("loads shift detail via carerShiftsApi.get(id)", () => {
    const detail = readSrc("components/carer/CarerShiftDetail.tsx");
    const queries = readSrc("lib/carer-shifts-queries.ts");
    expect(detail).toContain("useCarerShift");
    expect(queries).toContain('["carer-shift", id]');
    expect(queries).toContain("carerShiftsApi.get(id)");
  });

  it("blocks incomplete carers through parent requireCarerSessionForPortal", () => {
    const guards = readSrc("lib/carer-route-guards.ts");
    const layout = readSrc("routes/carer/shifts.tsx");
    expect(layout).toContain("requireCarerSessionForPortal");
    expect(guards).toContain("onboardingComplete(session)");
    expect(guards).toContain("CARER_ONBOARDING_HUB_PATH");
  });
});

describe("carer shift detail presentation", () => {
  const detail = () => readSrc("components/carer/CarerShiftDetail.tsx");

  it("shows status badges only for cancelled and completed shifts", () => {
    const src = detail();
    expect(src).toContain("carerShiftShowsStatusBadge");
    expect(src).toContain("CarerShiftStatusBadge");
    expect(src).toContain("shift.status");
    expect(src).not.toContain("torontoToday");
  });

  it("prioritises centre name, date, time, and location for carers", () => {
    const src = detail();
    expect(src).toContain("formatFullCalendarDateWithYearLabel");
    expect(src).toContain("formatAvailabilityWindowDisplay");
    expect(src).toContain("centre.name");
    expect(src).toContain("centre.address");
    expect(src).toContain("centre.city");
    expect(src).not.toContain("shift.roleNeeded");
    expect(src).not.toContain("Role");
  });

  it("shows cancelled supporting copy and optional own cancellation reason", () => {
    const src = detail();
    expect(src).toContain('shift.status === "cancelled"');
    expect(src).toContain("This shift has been cancelled.");
    expect(src).toContain("shift.cancellationReason");
  });

  it("provides Back to shifts navigation", () => {
    const src = detail();
    expect(src).toContain('to="/carer/shifts"');
    expect(src).toContain("Back to shifts");
  });
});

describe("carer shift detail not found and errors", () => {
  it("shows generic not-found state for 404 without ownership leaks", () => {
    const src = readSrc("components/carer/CarerShiftDetail.tsx");
    expect(src).toContain("Shift not found");
    expect(src).toContain("This shift is no longer available or is not assigned to your account.");
    expect(src).toContain("error.status === 404");
    expect(src).not.toContain("reassigned");
    expect(src).not.toContain("another staff");
  });

  it("shows retryable load error for non-404 failures", () => {
    const src = readSrc("components/carer/CarerShiftDetail.tsx");
    expect(src).toContain("Unable to load shift details.");
    expect(src).toContain("Try again");
  });

  it("includes deliberate loading skeleton", () => {
    const src = readSrc("components/carer/CarerShiftDetail.tsx");
    expect(src).toContain("CarerShiftDetailSkeleton");
    expect(src).toContain('aria-busy="true"');
  });
});

describe("carer shift detail has no self-cancellation UI", () => {
  const detail = () => readSrc("components/carer/CarerShiftDetail.tsx");

  it("does not expose cancel shift actions or cancellation mutation hooks", () => {
    const src = detail();
    expect(src).not.toContain("Cancel shift");
    expect(src).not.toContain("Cancel this shift?");
    expect(src).not.toContain("useCancelCarerShift");
    expect(src).not.toContain("carer-shift-cancellation");
    expect(src).not.toContain("Reason for cancellation");
  });

  it("still shows cancelled state when Ops cancels a shift", () => {
    const src = detail();
    expect(src).toContain("Shift cancelled");
    expect(src).toContain("This shift has been cancelled.");
    expect(src).toContain("cancellationReason");
  });
});

describe("carer shifts read-only security", () => {
  it("does not expose direct shift status mutation in carer UI source", () => {
    const sources = [
      "components/carer/CarerShiftsManager.tsx",
      "routes/carer/shifts.tsx",
      "routes/carer/shifts.index.tsx",
      "routes/carer/index.tsx",
    ];
    const forbidden = [
      "Accept shift",
      "Decline shift",
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

  it("does not expose internal notes, contacts, or ops-only fields in detail UI", () => {
    const src = readSrc("components/carer/CarerShiftDetail.tsx");
    const forbidden = [
      "internalNotes",
      "Staffpoint",
      "assignedStaffId",
    ];
    for (const phrase of forbidden) {
      expect(src).not.toContain(phrase);
    }
  });

  it("uses full-card links and limits status badges to cancelled/completed", () => {
    const card = readSrc("components/carer/CarerShiftCard.tsx");
    const display = readSrc("lib/carer-shifts-display.ts");
    expect(card).toContain("carerShiftShowsStatusBadge");
    expect(card).not.toContain("View details");
    expect(display).toContain("carerShiftShowsStatusBadge");
    expect(display).not.toContain("torontoToday");
    expect(display).not.toContain("new Date(");
  });
});

describe("ops shift cancellation regression", () => {
  it("uses standard cancelled shift status without request workflow UI", () => {
    const detail = readSrc("routes/_authenticated/shifts.$id.tsx");
    const list = readSrc("routes/_authenticated/shifts.index.tsx");
    expect(detail).toContain("cancellationReason");
    expect(detail).not.toContain("Cancellation requested");
    expect(detail).not.toContain("getCancellationRequest");
    expect(detail).not.toContain("Mark request resolved");
    expect(list).not.toContain("Cancellation requested");
    expect(list).not.toContain("cancellationRequested");
  });
});

describe("carer shifts onboarding isolation", () => {
  it("does not modify onboarding routes", () => {
    const onboarding = readSrc("routes/carer/onboarding/index.tsx");
    expect(onboarding).not.toContain("CarerShifts");
    expect(onboarding).not.toContain("carer-shifts");
  });
});
