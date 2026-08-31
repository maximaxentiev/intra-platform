import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("Batch Shift Requests Phase D", () => {
  const batchWorkspace = read("routes/_authenticated/shifts.batches.$id.tsx");
  const progressStatus = read("components/shifts/BatchProgressEmailStatus.tsx");

  it("shows progress email status in batch workspace", () => {
    expect(batchWorkspace).toContain("BatchProgressEmailStatus");
    expect(batchWorkspace).toContain("progressEmailStatus");
  });

  it("uses canonical status labels and retry action", () => {
    expect(progressStatus).toContain("Centre progress update scheduled");
    expect(progressStatus).toContain("Centre progress update sent");
    expect(progressStatus).toContain("Centre progress update could not be sent");
    expect(progressStatus).toContain("Retry progress email");
  });

  it("does not add Complete Request UI", () => {
    expect(batchWorkspace).not.toContain("Complete Request");
  });
});
