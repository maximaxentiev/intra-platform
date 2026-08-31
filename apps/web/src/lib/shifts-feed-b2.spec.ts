import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("Shifts feed Phase B2 UI", () => {
  const index = read("routes/_authenticated/shifts.index.tsx");
  const feedList = read("components/shifts/ShiftsFeedList.tsx");
  const db = read("lib/db.ts");

  it("loads grouped feed from GET /shifts/feed with server-side filters and pagination", () => {
    expect(index).toContain("shiftsApi.feed");
    expect(index).not.toContain("shiftsApi.list");
    expect(index).not.toContain(".filter((r) => r.addedToStaffpoint)");
    expect(db).toContain('"/shifts/feed"');
    expect(index).toContain("ReportPagination");
    expect(index).toContain("pageSize");
  });

  it("keeps filters and pagination in URL search params", () => {
    expect(index).toContain("page: z.coerce.number().optional()");
    expect(index).toContain("pageSize: z.coerce.number().optional()");
    expect(index).toContain("shiftFiltersToSearch(state, { page: 1, pageSize })");
  });

  it("renders batch parent rows with expand control separate from workspace navigation", () => {
    expect(feedList).toContain("Batch Request");
    expect(feedList).toContain("Open batch");
    expect(feedList).toContain('to="/shifts/batches/$id"');
    expect(feedList).toContain("aria-expanded");
    expect(feedList).toContain("onToggleBatch");
  });

  it("shows expanded batch children with normal shift columns and child navigation", () => {
    expect(feedList).toContain("matchingChildren");
    expect(feedList).toContain('to="/shifts/$id"');
    expect(feedList).not.toContain("availableStaff");
  });

  it("does not regress batch workspace or communication phases", () => {
    const workspace = read("routes/_authenticated/shifts.batches.$id.tsx");
    const assignment = read("../../api/src/shifts/shift-assignment-confirmation.service.ts");
    expect(workspace).not.toContain("Complete Request");
    expect(assignment).not.toContain("batchId");
    expect(index).not.toContain("Complete Request");
  });
});

describe("Shifts feed default pagination", () => {
  it("defaults to 25 items per page", () => {
    const ui = read("lib/shifts-feed-ui.ts");
    expect(ui).toContain("SHIFT_FEED_DEFAULT_PAGE_SIZE = 25");
    expect(ui).toContain("[10, 25, 50, 100]");
  });
});
