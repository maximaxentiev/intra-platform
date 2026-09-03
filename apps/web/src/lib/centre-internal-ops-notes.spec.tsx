// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CentreForm } from "@/components/CentreForm";
import { CentreDetailsCard } from "@/components/centres/CentreDetailsCard";
import {
  CentreInternalOpsNotesPanel,
  CentreInternalOpsNotesReadPanel,
} from "@/components/centres/CentreInternalOpsNotesPanel";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "centre-1",
        name: "Alpha Centre",
        internalOpsNotes: "Call Ops before assigning.",
      },
      {
        id: "centre-2",
        name: "Beta Centre",
        internalOpsNotes: null,
      },
    ],
  }),
}));

describe("centre internal ops notes UI", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("includes an internal-only field on the centre form", () => {
    const html = renderToString(
      <CentreForm initial={{}} onSubmit={async () => {}} submitLabel="Save" />,
    );

    expect(html).toContain("Internal Ops Notes");
    expect(html).toContain("Visible to the Intra Ops team only");
    expect(html).toContain("Rules, Policies, and Other Notes");
    expect(html).toContain('id="internalOpsNotes"');
  });

  it("renders a dedicated read panel on centre details when notes exist", () => {
    const html = renderToString(
      <CentreDetailsCard
        centre={{
          id: "centre-1",
          name: "Alpha Centre",
          address: "123 Main",
          city: "Toronto",
          hourlyRate: null,
          primaryChannel: "email",
          notes: "Public rules",
          internalOpsNotes: "Ops-only reminder",
          requiresQualificationForMatching: false,
          eceQualificationRequirement: "ece_or_rece",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        secondaryChannels={[]}
        onSave={async () => true}
      />,
    );

    expect(html).toContain("Internal Ops Notes");
    expect(html).toContain("Ops-only reminder");
    expect(html).toContain("Rules &amp; notes");
    expect(html).toContain("Public rules");
  });

  it("omits the read panel when centre details have no internal notes", () => {
    const html = renderToString(
      <CentreInternalOpsNotesReadPanel notes="   " />,
    );
    expect(html).toBe("");
  });

  it("renders the read-only panel when creating a shift for a centre with notes", () => {
    const html = renderToString(<CentreInternalOpsNotesPanel centreId="centre-1" />);
    expect(html).toContain("Internal Ops Notes");
    expect(html).toContain("Call Ops before assigning.");
    expect(html).toContain("For the Intra Ops team only");
  });

  it("hides the read-only panel when the selected centre has no internal notes", () => {
    const html = renderToString(<CentreInternalOpsNotesPanel centreId="centre-2" />);
    expect(html).toBe("");
  });

  it("wires the read-only panel into individual shift and batch create routes", () => {
    expect(read("src/routes/_authenticated/shifts.new.tsx")).toContain("CentreInternalOpsNotesPanel");
    expect(read("src/routes/_authenticated/shifts.batches.new.tsx")).toContain(
      "CentreInternalOpsNotesPanel",
    );
  });
});
