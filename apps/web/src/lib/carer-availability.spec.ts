import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api";

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
import {
  carerAvailabilityApi,
  groupSlotsByDay,
  mapAvailabilityApiError,
  sortAvailabilitySlots,
  validateClientTimeRange,
  type CarerAvailabilitySlot,
} from "@/lib/carer-availability";

const slot = (overrides: Partial<CarerAvailabilitySlot> = {}): CarerAvailabilitySlot => ({
  id: "slot-1",
  weekStartDate: "2026-08-10",
  dayOfWeek: 0,
  startTime: "09:00",
  endTime: "12:00",
  createdAt: "2026-08-13T12:00:00.000Z",
  ...overrides,
});

describe("carerAvailabilityApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists availability from staff-portal endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await carerAvailabilityApi.list("2026-08-10");
    expect(api.get).toHaveBeenCalledWith("/staff-portal/availability", {
      weekStart: "2026-08-10",
    });
  });

  it("creates without staffId", async () => {
    vi.mocked(api.post).mockResolvedValue(slot());
    await carerAvailabilityApi.create({
      weekStartDate: "2026-08-10",
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(api.post).toHaveBeenCalledWith("/staff-portal/availability", {
      weekStartDate: "2026-08-10",
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "17:00",
    });
    const body = vi.mocked(api.post).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("staffId");
  });

  it("patches by id", async () => {
    vi.mocked(api.patch).mockResolvedValue(slot());
    await carerAvailabilityApi.update("slot-1", { startTime: "10:00", endTime: "16:00" });
    expect(api.patch).toHaveBeenCalledWith("/staff-portal/availability/slot-1", {
      startTime: "10:00",
      endTime: "16:00",
    });
  });

  it("deletes by id", async () => {
    vi.mocked(api.del).mockResolvedValue({ ok: true });
    await carerAvailabilityApi.remove("slot-1");
    expect(api.del).toHaveBeenCalledWith("/staff-portal/availability/slot-1");
  });

  it("completes onboarding step 3", async () => {
    vi.mocked(api.post).mockResolvedValue({ onboardingCompletedAt: "2026-08-13T12:00:00.000Z" });
    await carerAvailabilityApi.completeStep3();
    expect(api.post).toHaveBeenCalledWith("/staff-portal/availability/complete-step-3");
  });
});

describe("validateClientTimeRange", () => {
  it("rejects equal or reversed ranges", () => {
    expect(validateClientTimeRange("09:00", "09:00")).toMatch(/after start/i);
    expect(validateClientTimeRange("17:00", "09:00")).toMatch(/after start/i);
  });

  it("accepts valid ranges", () => {
    expect(validateClientTimeRange("09:00", "17:00")).toBeNull();
  });
});

describe("sortAvailabilitySlots", () => {
  it("orders by day then start time", () => {
    const sorted = sortAvailabilitySlots([
      slot({ id: "b", dayOfWeek: 1, startTime: "14:00", endTime: "18:00" }),
      slot({ id: "a", dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }),
      slot({ id: "c", dayOfWeek: 0, startTime: "13:00", endTime: "17:00" }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["a", "c", "b"]);
  });
});

describe("groupSlotsByDay", () => {
  it("groups windows under day indices", () => {
    const grouped = groupSlotsByDay([
      slot({ id: "a", dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }),
      slot({ id: "b", dayOfWeek: 2, startTime: "14:00", endTime: "18:00" }),
    ]);
    expect(grouped.get(2)?.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("mapAvailabilityApiError", () => {
  it("maps overlap errors to friendly copy", () => {
    expect(
      mapAvailabilityApiError(
        new ApiError(400, "This time range overlaps an existing availability window."),
        "fallback",
      ),
    ).toMatch(/overlaps with availability/i);
  });

  it("maps duplicate errors", () => {
    expect(
      mapAvailabilityApiError(
        new ApiError(400, "An identical availability window already exists."),
        "fallback",
      ),
    ).toMatch(/matches availability/i);
  });
});

describe("carer availability security", () => {
  it("client source uses staff-portal endpoints only", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const src = readFileSync(join(root, "lib/carer-availability.ts"), "utf8");
    expect(src).toContain("/staff-portal/availability");
    expect(src).not.toMatch(/['"`]\/availability['"`]/);
    expect(src).not.toContain("staffId");
  });
});
