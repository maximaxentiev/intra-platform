import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("Batch Shift Requests Phase E", () => {
  const batchWorkspace = read("routes/_authenticated/shifts.batches.$id.tsx");
  const completeAction = read("components/shifts/BatchCompleteRequestAction.tsx");
  const finalStatus = read("components/shifts/BatchFinalConfirmationStatus.tsx");

  it("adds Complete Request action and final confirmation status", () => {
    expect(batchWorkspace).toContain("BatchCompleteRequestAction");
    expect(batchWorkspace).toContain("BatchFinalConfirmationStatus");
    expect(completeAction).toContain("Complete Request");
    expect(completeAction).toContain("getCompletionReadiness");
    expect(completeAction).toContain("completeRequest");
    expect(finalStatus).toContain("Retry Centre confirmation");
  });

  it("shows confirmation dialog with primary contact email", () => {
    expect(completeAction).toContain("primaryContactEmail");
    expect(completeAction).toContain("final Batch confirmation");
  });
});
