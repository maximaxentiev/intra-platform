// @vitest-environment ./vitest-minimal-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApplicationReviewedButton } from "@/components/applications/ApplicationReviewedButton";
import type { ApplicationRow } from "@/lib/applications";

vi.mock("@/components/applications/ApplicationActions", () => ({
  ApplicationActionButtons: () => null,
}));

vi.mock("@/components/applications/documents", () => ({
  DocumentCard: () => null,
}));

vi.mock("@/lib/applications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/applications")>();
  return {
    ...actual,
    applicationsApi: {
      activity: vi.fn().mockResolvedValue([]),
    },
  };
});

const baseRow = {
  id: "app-1",
  status: "new",
  submittedAt: "2026-08-01T12:00:00.000Z",
  reviewedAt: null as string | null,
  applicant: {
    role: "eca" as const,
    firstName: "Jane",
    lastName: "Applicant",
    email: "jane@example.com",
    phone: "555-0100",
  },
  metadata: {
    submittedAt: "2026-08-01T12:00:00.000Z",
    sourcePage: "",
    sourceUrl: "",
    formId: "",
    consentAccepted: true,
    consentPolicyVersion: "1",
    consentAcceptedAt: "2026-08-01T12:00:00.000Z",
  },
  compliance: {
    firstAidCprExpiry: null,
    immunizationStatus: "complete",
    covidVaccinationStatus: "yes",
  },
  languages: { englishProficiency: "fluent", additionalLanguages: [] },
  documents: [],
  workflow: { reviewedAt: null },
} satisfies Partial<ApplicationRow>;

const pendingRow = {
  ...baseRow,
  id: "app-pending",
  reviewedAt: null,
  applicant: {
    ...baseRow.applicant,
    middleName: "",
    gender: "",
  },
  eligibility: { gtaEligible: true, statusInCanada: "permanent_resident" },
  experience: { duration: "2_years", description: "", nannyExperienceTypes: [] },
  roleSpecific: {
    qualificationStatus: "eca_canada",
    nannyTrainingCompleted: null,
    nannyTrainingDescription: "",
  },
  compliance: {
    vscStatus: "approved",
    vscIssueOrRequestDate: null,
    firstAidCprStatus: "approved",
    firstAidCprExpiry: null,
    immunizationStatus: "complete",
    covidVaccinationStatus: "yes",
  },
  metadata: {
    ...baseRow.metadata,
    payloadSnapshot: {},
  },
  workflow: {
    contactedAt: null,
    hiredAt: null,
    hiredStaffId: null,
    rejectedAt: null,
    rejectionEmailSentAt: null,
    reviewedAt: null,
  },
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
} as ApplicationRow;
const reviewedRow = {
  ...pendingRow,
  id: "app-reviewed",
  reviewedAt: "2026-08-02T09:00:00.000Z",
  workflow: { ...pendingRow.workflow, reviewedAt: "2026-08-02T09:00:00.000Z" },
} as ApplicationRow;

function ApplicationsListHarness({ rows }: { rows: ApplicationRow[] }) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            data-reviewed={row.reviewedAt ? "true" : "false"}
            className={row.reviewedAt ? "bg-success-soft/50" : undefined}
          >
            <td>{row.applicant.firstName}</td>
            <td>
              <ApplicationReviewedButton
                reviewed={Boolean(row.reviewedAt)}
                pending={false}
                onReview={() => {}}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe("applications list rendering", () => {
  it("renders pending and reviewed rows without ReferenceError", () => {
    expect(() =>
      renderToString(<ApplicationsListHarness rows={[pendingRow, reviewedRow]} />),
    ).not.toThrow();

    const html = renderToString(<ApplicationsListHarness rows={[pendingRow, reviewedRow]} />);
    expect(html).toContain('data-reviewed="false"');
    expect(html).toContain('data-reviewed="true"');
    expect(html).toContain("bg-success-soft/50");
    expect(html).toContain("Reviewed");
  });

  it("opens the detail drawer without the removed pending action state", async () => {
    const { ApplicationDrawer } = await import("@/components/applications/ApplicationDrawer");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() =>
      renderToString(
        <QueryClientProvider client={queryClient}>
          <ApplicationDrawer
            row={pendingRow}
            open
            onOpenChange={() => {}}
            pendingAction={null}
            onAction={() => {}}
            onOpenDoc={() => {}}
          />
        </QueryClientProvider>,
      ),
    ).not.toThrow();
  });
});

describe("applications page regression guard", () => {
  it("does not reference the removed pending workflow state in the route", () => {
    const page = readApplicationsPage();
    expect(page).not.toMatch(/\bpending\?\.id\b/);
    expect(page).not.toContain("runAction");
    expect(page).toContain("pendingAction={null}");
    expect(page).toContain("ApplicationReviewedButton");
    expect(page).not.toContain("ApplicationActionButtons");
  });
});

function readApplicationsPage() {
  return readFileSync(join(process.cwd(), "src/routes/_authenticated/applications.tsx"), "utf8");
}
