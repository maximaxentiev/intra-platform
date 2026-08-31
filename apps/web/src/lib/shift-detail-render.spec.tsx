// @vitest-environment ./vitest-minimal-dom

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftActivityFeed } from "@/components/shifts/ShiftActivityFeed";
import type { ActivityLogItem } from "@/lib/reports-types";

type ShiftRow = {
  id: string;
  centreId: string;
  assignedStaffId: string | null;
};

type EditVals = {
  centreId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
};

/** Mirrors ShiftDetail hook order for loading → loaded transitions. */
function ShiftDetailHookOrderProbe({
  shift,
  editing,
  commDialogOpen,
  resendDialogOpen,
  editValsForQueries,
  id,
  onRender,
}: {
  shift: ShiftRow | undefined;
  editing: boolean;
  commDialogOpen: boolean;
  resendDialogOpen: boolean;
  editValsForQueries: EditVals;
  id: string;
  onRender?: (phase: "loading" | "loaded") => void;
}) {
  useQuery({
    enabled: !!shift,
    queryKey: ["shift-available", id],
    queryFn: async () => [],
  });

  useState(false);
  useState<EditVals | null>(null);
  useState<string | null>(null);
  useState(false);
  useState<null>(null);
  useState(false);
  useState(false);
  useState(false);
  useState(false);
  useState(false);
  useState(false);
  useState(false);
  useState<null>(null);
  useState<null>(null);
  useState<null>(null);
  useState<null>(null);
  useState(false);
  useState(false);

  useQuery({
    enabled: !!shift,
    queryKey: ["centre-contacts", shift?.centreId],
    queryFn: async () => [],
  });

  useQuery({
    enabled: !!shift?.assignedStaffId,
    queryKey: ["staff", shift?.assignedStaffId],
    queryFn: async () => null,
  });

  useQuery({
    enabled: !!shift?.assignedStaffId && resendDialogOpen,
    queryKey: ["shift-resend-availability", id],
    queryFn: async () => null,
  });

  useQuery({
    enabled: !!shift && editing && commDialogOpen,
    queryKey: ["centre-contacts", editValsForQueries.centreId],
    queryFn: async () => [],
  });

  if (!shift) {
    onRender?.("loading");
    return <div data-testid="shift-loading">Loading</div>;
  }

  onRender?.("loaded");
  return <div data-testid="shift-loaded">Loaded</div>;
}

const mockShift: ShiftRow = {
  id: "shift-1",
  centreId: "centre-1",
  assignedStaffId: null,
};

const emptyEditVals: EditVals = {
  centreId: "",
  shiftDate: "",
  startTime: "",
  endTime: "",
  roleNeeded: "",
  addedToStaffpoint: false,
};

const sampleActivity: ActivityLogItem = {
  id: "evt-1",
  occurredAt: "2026-08-27T14:55:00.000Z",
  category: "shifts",
  action: "shift_created",
  title: "Shift created",
  description: "Sample Centre on 2026-08-27",
  actor: { type: "ops_user", id: "user-1", name: "Laura Creane" },
};

function renderProbe(
  shift: ShiftRow | undefined,
  queryClient: QueryClient,
  onRender?: (phase: "loading" | "loaded") => void,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ShiftDetailHookOrderProbe
          id="shift-1"
          shift={shift}
          editing={false}
          commDialogOpen={false}
          resendDialogOpen={false}
          onRender={onRender}
          editValsForQueries={
            shift
              ? {
                  centreId: shift.centreId,
                  shiftDate: "2026-08-27",
                  startTime: "09:00",
                  endTime: "17:00",
                  roleNeeded: "educator",
                  addedToStaffpoint: false,
                }
              : emptyEditVals
          }
        />
      </QueryClientProvider>,
    );
  });
  return { container, root };
}

describe("shift detail hook order regression", () => {
  const roots: Root[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      act(() => root?.unmount());
    }
    document.body.replaceChildren();
  });

  it("does not change hook order when shift data arrives after loading", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const phases: Array<"loading" | "loaded"> = [];

    const first = renderProbe(undefined, queryClient, (phase) => phases.push(phase));
    roots.push(first.root);
    expect(phases).toEqual(["loading"]);

    await act(async () => {
      first.root.render(
        <QueryClientProvider client={queryClient}>
          <ShiftDetailHookOrderProbe
            id="shift-1"
            shift={mockShift}
            editing={false}
            commDialogOpen={false}
            resendDialogOpen={false}
            onRender={(phase) => phases.push(phase)}
            editValsForQueries={{
              centreId: mockShift.centreId,
              shiftDate: "2026-08-27",
              startTime: "09:00",
              endTime: "17:00",
              roleNeeded: "educator",
              addedToStaffpoint: false,
            }}
          />
        </QueryClientProvider>,
      );
    });

    expect(phases).toEqual(["loading", "loaded"]);
  });
});

describe("shift activity feed presentation", () => {
  it("renders a vertical event feed without table markup", () => {
    const html = renderToString(<ShiftActivityFeed items={[sampleActivity]} />);

    expect(html).toContain("Shift created");
    expect(html).toContain("Sample Centre on 2026-08-27");
    expect(html).toContain("<ol");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("min-w-[720px]");
  });

  it("wraps long detail text in readable feed rows", () => {
    const longItem: ActivityLogItem = {
      ...sampleActivity,
      id: "evt-2",
      description:
        "Very Long Centre Name That Should Wrap Inside The Sidebar Without Forcing Horizontal Scrolling",
    };
    const html = renderToString(<ShiftActivityFeed items={[longItem]} />);

    expect(html).toContain("min-w-0");
    expect(html).toContain(longItem.description);
  });
});
