import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("Batch Shift Requests Phase F", () => {
  const batchWorkspace = read("routes/_authenticated/shifts.batches.$id.tsx");
  const completeAction = read("components/shifts/BatchCompleteRequestAction.tsx");
  const batchActivity = read("components/shifts/BatchActivityLogPanel.tsx");

  it("adds Batch Activity panel and readiness conflict UX", () => {
    expect(batchWorkspace).toContain("BatchActivityLogPanel");
    expect(batchActivity).toContain("Batch Activity");
    expect(batchActivity).toContain("getBatchActivity");
    expect(completeAction).toContain("conflictBlockers");
    expect(completeAction).toContain("parseConflictBlockers");
    expect(completeAction).toContain("no longer ready");
  });
});
