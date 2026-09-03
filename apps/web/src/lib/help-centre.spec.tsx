// @vitest-environment ./vitest-minimal-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpArticleProse } from "@/components/help/HelpArticleProse";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";
import { HelpArticleLayout } from "@/components/help/HelpArticleLayout";
import { HelpSearchInput } from "@/components/help/HelpSearchInput";
import { getHelpArticle, getRelatedHelpArticles } from "@/lib/help-articles";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => (config: unknown) => config,
}));

describe("help presentation components", () => {
  it("renders Important and Before you continue callouts", () => {
    const important = renderToString(
      <HelpCallout title="Important" variant="important">
        Assignment sends emails.
      </HelpCallout>,
    );
    const before = renderToString(
      <HelpBeforeYouContinueCallout>Cancellation cannot be undone.</HelpBeforeYouContinueCallout>,
    );

    expect(important).toContain("Important");
    expect(important).toContain('role="note"');
    expect(before).toContain("Before you continue");
  });

  it("renders screenshot with required alt text", () => {
    const html = renderToString(
      <HelpScreenshot
        src="/help/placeholder-screenshot.svg"
        alt="Example Ops screen"
        caption="Sample caption"
      />,
    );
    expect(html).toContain('alt="Example Ops screen"');
    expect(html).toContain("Sample caption");
    expect(html).toContain("Enlarge screenshot");
  });

  it("returns null when screenshot src is omitted", () => {
    const html = renderToString(
      <HelpScreenshot alt="Pending screenshot" caption="Not shown yet" />,
    );
    expect(html).toBe("");
  });

  it("renders search input with accessible label", () => {
    const html = renderToString(<HelpSearchInput value="" onChange={() => {}} />);
    expect(html).toContain("Search Help");
  });

  it("applies horizontal scroll styling for prose tables", () => {
    const html = renderToString(
      <HelpArticleProse>
        <table>
          <tbody>
            <tr>
              <td>Example</td>
            </tr>
          </tbody>
        </table>
      </HelpArticleProse>,
    );
    expect(html).toContain("overflow-x-auto");
  });

  it("applies readable typography spacing for article prose", () => {
    const html = renderToString(
      <HelpArticleProse>
        <h2>Section</h2>
        <p>Paragraph</p>
        <ul>
          <li>Item</li>
        </ul>
      </HelpArticleProse>,
    );
    expect(html).toContain("prose-h2:mt-10");
    expect(html).toContain("prose-p:leading-relaxed");
    expect(html).toContain("prose-ul:my-4");
  });
});

describe("platform overview article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/platform-overview-body.tsx"),
      "utf8",
    );
    expect(body).toContain("What the platform is for");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/platform-overview-body.tsx"),
      "utf8",
    );
    const slugs = [
      "manage-centres",
      "manage-staff-profiles-and-availability",
      "create-an-individual-shift",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents main navigation sections", () => {
    const html = renderToString(<HelpArticleLayout article={getHelpArticle("platform-overview")!} />);
    for (const heading of [
      "What the platform is for",
      "Main navigation",
      "Dashboard",
      "Shifts",
      "Centres",
      "Staff",
      "Availability",
      "Reports",
      "Applications",
      "Users",
      "Help",
      "Your account",
      "Before you start",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("platform-overview");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "manage-centres",
      "manage-staff-profiles-and-availability",
      "create-an-individual-shift",
      "communications-notes-and-important-terminology",
    ]);

    const html = renderToString(<HelpArticleLayout article={getHelpArticle("platform-overview")!} />);
    expect(html).toContain("Related Help");
    expect(html).toContain("Manage Centres");
    expect(html).toContain("Create an Individual Shift");
    expect(html).not.toContain('src="/help/placeholder-screenshot.svg"');
  });
});

describe("manage centres article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/manage-centres-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Find a Centre");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/manage-centres-body.tsx"),
      "utf8",
    );
    const slugs = [
      "communications-notes-and-important-terminology",
      "create-an-individual-shift",
      "understand-available-staff-and-priority",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents main centre management sections", () => {
    const html = renderToString(<HelpArticleLayout article={getHelpArticle("manage-centres")!} />);
    for (const heading of [
      "Find a Centre",
      "Create a new Centre",
      "Edit Centre details",
      "Manage Centre contacts",
      "Add or remove Top staff",
      "Ban or unban a staff member",
      "View a Centre&#x27;s Shifts",
      "Delete a Centre",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("renders Important and Before you continue callouts", () => {
    const html = renderToString(<HelpArticleLayout article={getHelpArticle("manage-centres")!} />);
    expect(html).toContain("Important");
    expect(html).toContain("Before you continue");
    expect(html).toContain("primary contact");
    expect(html).toContain("Top staff and Banned staff");
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("manage-centres");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "manage-staff-profiles-and-availability",
      "understand-available-staff-and-priority",
      "create-an-individual-shift",
      "communications-notes-and-important-terminology",
    ]);

    const html = renderToString(<HelpArticleLayout article={getHelpArticle("manage-centres")!} />);
    expect(html).toContain("Related Help");
    expect(html).toContain("Understand Available Staff");
    expect(html).not.toContain('src="/help/manage-centres/');
  });
});

describe("manage staff profiles article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(
        process.cwd(),
        "src/content/help/content/manage-staff-profiles-and-availability-body.tsx",
      ),
      "utf8",
    );
    expect(body).toContain("Find a Carer");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(
        process.cwd(),
        "src/content/help/content/manage-staff-profiles-and-availability-body.tsx",
      ),
      "utf8",
    );
    const slugs = [
      "manage-centres",
      "review-and-approve-staff-documents",
      "understand-available-staff-and-priority",
      "create-an-individual-shift",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents main staff management sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("manage-staff-profiles-and-availability")!} />,
    );
    for (const heading of [
      "Find a Carer",
      "Understand the Staff profile",
      "Create Staff manually",
      "Manage Carer portal access",
      "Review and update a Carer",
      "Use Team Availability",
      "View Centre preferences",
      "Documents tab",
      "Rare administrative actions",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("renders portal, availability, and delete warnings", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("manage-staff-profiles-and-availability")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Before you continue");
    expect(html).toContain("Portal invitations");
    expect(html).toContain("Top centres");
    expect(html).not.toContain('src="/help/manage-staff-profiles-and-availability/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("manage-staff-profiles-and-availability");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "manage-centres",
      "review-and-approve-staff-documents",
      "understand-available-staff-and-priority",
      "create-an-individual-shift",
    ]);

    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("manage-staff-profiles-and-availability")!} />,
    );
    expect(html).toContain("Related Help");
    expect(html).toContain("Review &amp; Approve Staff Documents");
  });
});

describe("review staff documents article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/review-and-approve-staff-documents-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Find documents that need review");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/review-and-approve-staff-documents-body.tsx"),
      "utf8",
    );
    const slugs = [
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents review and status sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("review-and-approve-staff-documents")!} />,
    );
    for (const heading of [
      "Find documents that need review",
      "Understand document statuses",
      "Review a submitted document",
      "Approve a document",
      "Flag an issue",
      "Vulnerable Sector Check",
      "First Aid",
      "Qualification documents",
      "How documents affect Shift eligibility",
      "Share documents",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Pending Review");
    expect(html).toContain("Issue Flagged");
    expect(html).toContain("Expiring Soon");
  });

  it("renders Important callouts and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("review-and-approve-staff-documents")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Approving a document");
    expect(html).not.toContain('src="/help/review-and-approve-staff-documents/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("review-and-approve-staff-documents");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "manage-staff-profiles-and-availability",
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("create individual shift article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/create-an-individual-shift-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Before you begin");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/create-an-individual-shift-body.tsx"),
      "utf8",
    );
    const slugs = [
      "create-a-batch-request",
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents create shift flow sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("create-an-individual-shift")!} />,
    );
    for (const heading of [
      "Before you begin",
      "Create the shift",
      "Choose the Centre",
      "Enter the date and time",
      "Choose the role",
      "Staffpoint",
      "Add Shift Notes",
      "What happens next",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("ECA");
    expect(html).toContain("RECE");
    expect(html).toContain("Pending");
  });

  it("renders Important callout and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("create-an-individual-shift")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Double-check the centre");
    expect(html).not.toContain('src="/help/create-an-individual-shift/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("create-an-individual-shift");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "create-a-batch-request",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("understand available staff article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/understand-available-staff-and-priority-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Eligibility comes first");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/understand-available-staff-and-priority-body.tsx"),
      "utf8",
    );
    const slugs = [
      "assign-replace-or-unassign-a-carer",
      "review-and-approve-staff-documents",
      "manage-staff-profiles-and-availability",
      "manage-centres",
      "edit-or-cancel-a-shift",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents available staff reference sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("understand-available-staff-and-priority")!} />,
    );
    for (const heading of [
      "What Available staff shows",
      "Eligibility comes first",
      "Top staff",
      "Banned staff",
      "Role and qualifications",
      "Availability and schedule conflicts",
      "Documents and onboarding",
      "What affects priority",
      "Contacted",
      "How to use the list",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Two-hour buffer");
    expect(html).toContain("RECE Proof");
  });

  it("renders Important callout and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("understand-available-staff-and-priority")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Top status or a high priority number never overrides");
    expect(html).toContain("Top and Banned are mutually exclusive");
    expect(html).not.toContain('src="/help/understand-available-staff-and-priority/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("understand-available-staff-and-priority");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "assign-replace-or-unassign-a-carer",
      "review-and-approve-staff-documents",
      "manage-staff-profiles-and-availability",
      "manage-centres",
    ]);
  });
});

describe("assign replace unassign article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/assign-replace-or-unassign-a-carer-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Before you assign");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/assign-replace-or-unassign-a-carer-body.tsx"),
      "utf8",
    );
    const slugs = [
      "understand-available-staff-and-priority",
      "edit-or-cancel-a-shift",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents assignment workflow sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("assign-replace-or-unassign-a-carer")!} />,
    );
    for (const heading of [
      "Before you assign",
      "Assign a Carer",
      "What happens after assignment",
      "Replace an assigned Carer",
      "Unassign a Carer",
      "Individual Shift vs Batch Request",
      "Resend an assignment confirmation",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Contacted");
    expect(html).toContain("Email the previous Carer to confirm they have been unassigned");
    expect(html).toContain("Centre communication is managed through this Batch Request");
  });

  it("renders Important callouts and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("assign-replace-or-unassign-a-carer")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Review the confirmation dialog before assigning");
    expect(html).toContain("review previous-carer and centre communication choices carefully");
    expect(html).not.toContain('src="/help/assign-replace-or-unassign-a-carer/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("assign-replace-or-unassign-a-carer");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "understand-available-staff-and-priority",
      "edit-or-cancel-a-shift",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("edit or cancel shift article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/edit-or-cancel-a-shift-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Edit a Shift");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/edit-or-cancel-a-shift-body.tsx"),
      "utf8",
    );
    const slugs = [
      "assign-replace-or-unassign-a-carer",
      "understand-available-staff-and-priority",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
      "cancel-a-batch-request",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents edit and cancel workflow sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("edit-or-cancel-a-shift")!} />,
    );
    for (const heading of [
      "Edit a Shift",
      "If no Carer is assigned",
      "If a Carer is already assigned",
      "If the revised Shift no longer works for the Carer",
      "Cancel a Shift",
      "Editing a Shift inside a Batch Request",
      "Cancel vs Delete",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Save Shift changes");
    expect(html).toContain("Keep Staff assigned — availability confirmed");
    expect(html).toContain("Cancellation reason");
  });

  it("renders Important and Before you continue callouts and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("edit-or-cancel-a-shift")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Review the dialog before saving");
    expect(html).toContain("Cancelling a shift changes its operational status");
    expect(html).toContain("Before you continue");
    expect(html).toContain("Deleting a shift is permanent");
    expect(html).not.toContain('src="/help/edit-or-cancel-a-shift/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("edit-or-cancel-a-shift");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "assign-replace-or-unassign-a-carer",
      "understand-available-staff-and-priority",
      "fill-complete-and-update-a-batch-request",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("create batch request article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/create-a-batch-request-body.tsx"),
      "utf8",
    );
    expect(body).toContain("When to use a Batch Request");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/create-a-batch-request-body.tsx"),
      "utf8",
    );
    const slugs = [
      "create-an-individual-shift",
      "fill-complete-and-update-a-batch-request",
      "understand-available-staff-and-priority",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents create batch workflow sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("create-a-batch-request")!} />,
    );
    for (const heading of [
      "When to use a Batch Request",
      "Choose the Centre",
      "Add the requested Shifts",
      "Duplicate a Shift",
      "Add or remove Shifts",
      "Shift Notes and Internal Comments",
      "Create the Batch",
      "What happens next",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("copy Internal Comment");
    expect(html).toContain("One shift remaining");
    expect(html).toContain("Open");
  });

  it("renders Important callout and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("create-a-batch-request")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Keep Shift Notes and Internal Comments separate");
    expect(html).not.toContain('src="/help/create-a-batch-request/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("create-a-batch-request");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "create-an-individual-shift",
      "fill-complete-and-update-a-batch-request",
      "understand-available-staff-and-priority",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("fill complete update batch article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/fill-complete-and-update-a-batch-request-body.tsx"),
      "utf8",
    );
    expect(body).toContain("Understand the Batch workspace");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/fill-complete-and-update-a-batch-request-body.tsx"),
      "utf8",
    );
    const slugs = [
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "create-a-batch-request",
      "edit-or-cancel-a-shift",
      "cancel-a-batch-request",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents batch fulfillment lifecycle sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("fill-complete-and-update-a-batch-request")!} />,
    );
    for (const heading of [
      "Understand the Batch workspace",
      "Fill the Shifts",
      "Understand Batch progress",
      "Complete the Batch Request",
      "What the Centre receives",
      "If the Batch changes after completion",
      "Send Updates Confirmation",
      "Check communication status and activity",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Open");
    expect(html).toContain("Ready to send updates");
    expect(html).toContain("Updates required");
    expect(html).toContain("Centre communication is managed through this Batch Request");
    expect(html).toContain("Changes to highlight");
    expect(html).toContain("always included regardless of which boxes are selected");
  });

  it("renders Important callout and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("fill-complete-and-update-a-batch-request")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Complete Request schedules the consolidated centre confirmation");
    expect(html).not.toContain('src="/help/fill-complete-and-update-a-batch-request/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("fill-complete-and-update-a-batch-request");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "create-a-batch-request",
      "assign-replace-or-unassign-a-carer",
      "edit-or-cancel-a-shift",
      "cancel-a-batch-request",
    ]);
  });
});

describe("cancel batch request article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/cancel-a-batch-request-body.tsx"),
      "utf8",
    );
    expect(body).toContain("When to cancel the entire Batch");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(process.cwd(), "src/content/help/content/cancel-a-batch-request-body.tsx"),
      "utf8",
    );
    const slugs = [
      "edit-or-cancel-a-shift",
      "fill-complete-and-update-a-batch-request",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents batch cancellation workflow sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("cancel-a-batch-request")!} />,
    );
    for (const heading of [
      "When to cancel the entire Batch",
      "Cancel the Batch",
      "If no Carers have been assigned",
      "If Carers are assigned but the Centre has not been confirmed",
      "If the Centre has already received a Batch confirmation",
      "What happens to the child Shifts",
      "What happens to communications and reminders",
      "After the Batch is cancelled",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Carer email available?");
    expect(html).toContain("Centre email available?");
    expect(html).toContain("Email assigned Carers about the cancellation");
    expect(html).toContain("Choose recipients");
  });

  it("renders Before you continue callout and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("cancel-a-batch-request")!} />,
    );
    expect(html).toContain("Before you continue");
    expect(html).toContain("Cancelling a Batch cancels all remaining active Shifts");
    expect(html).not.toContain('src="/help/cancel-a-batch-request/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("cancel-a-batch-request");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "fill-complete-and-update-a-batch-request",
      "edit-or-cancel-a-shift",
      "assign-replace-or-unassign-a-carer",
      "communications-notes-and-important-terminology",
    ]);
  });
});

describe("communications reference article", () => {
  it("uses authored content instead of placeholder copy", () => {
    const body = readFileSync(
      join(
        process.cwd(),
        "src/content/help/content/communications-notes-and-important-terminology-body.tsx",
      ),
      "utf8",
    );
    expect(body).toContain("Notes and comments");
    expect(body).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
  });

  it("links to valid Help article slugs from the body", () => {
    const body = readFileSync(
      join(
        process.cwd(),
        "src/content/help/content/communications-notes-and-important-terminology-body.tsx",
      ),
      "utf8",
    );
    const slugs = [
      "manage-centres",
      "assign-replace-or-unassign-a-carer",
      "edit-or-cancel-a-shift",
      "fill-complete-and-update-a-batch-request",
      "cancel-a-batch-request",
      "review-and-approve-staff-documents",
      "understand-available-staff-and-priority",
      "manage-staff-profiles-and-availability",
      "create-an-individual-shift",
      "create-a-batch-request",
    ];
    for (const slug of slugs) {
      expect(body).toContain(`slug="${slug}"`);
      expect(getHelpArticle(slug)).toBeDefined();
    }
  });

  it("documents reference terminology sections", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("communications-notes-and-important-terminology")!} />,
    );
    for (const heading of [
      "Notes and comments",
      "When the platform sends communications",
      "Individual Shift vs Batch Request communications",
      "Shift statuses",
      "Batch Request statuses",
      "Important staffing terms",
      "Where to learn more",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("Centre Rules, Policies, and Other Notes");
    expect(html).toContain("Do not put Ops-only information in Shift Notes");
    expect(html).toContain("Centre communication is managed through this Batch Request");
    expect(html).toContain("RECE is not a Staff profile role");
    expect(html).toContain("Primary contact");
    expect(html).toContain("Cancel vs Delete");
  });

  it("renders Important callouts and no broken screenshot markup", () => {
    const html = renderToString(
      <HelpArticleLayout article={getHelpArticle("communications-notes-and-important-terminology")!} />,
    );
    expect(html).toContain("Important");
    expect(html).toContain("Always review the recipient choices");
    expect(html).not.toContain('src="/help/communications-notes-and-important-terminology/');
  });

  it("renders related Help links configured in the registry", () => {
    const related = getRelatedHelpArticles("communications-notes-and-important-terminology");
    expect(related).toHaveLength(4);
    expect(related.map((article) => article.slug)).toEqual([
      "understand-available-staff-and-priority",
      "assign-replace-or-unassign-a-carer",
      "fill-complete-and-update-a-batch-request",
      "manage-centres",
    ]);
  });
});

describe("help V1 authored bodies", () => {
  const AUTHORED_SLUGS = [
    "platform-overview",
    "manage-centres",
    "manage-staff-profiles-and-availability",
    "review-and-approve-staff-documents",
    "create-an-individual-shift",
    "understand-available-staff-and-priority",
    "assign-replace-or-unassign-a-carer",
    "edit-or-cancel-a-shift",
    "create-a-batch-request",
    "fill-complete-and-update-a-batch-request",
    "cancel-a-batch-request",
    "communications-notes-and-important-terminology",
  ] as const;

  it("uses authored content for all 12 planned articles", () => {
    for (const slug of AUTHORED_SLUGS) {
      const html = renderToString(<HelpArticleLayout article={getHelpArticle(slug)!} />);
      expect(html).not.toContain("Detailed instructions and screenshots for this topic are being prepared");
    }
  });
});

describe("help article page layout", () => {
  it("renders article content and related links", () => {
    const article = getHelpArticle("platform-overview");
    expect(article).toBeDefined();

    const html = renderToString(<HelpArticleLayout article={article!} />);
    expect(html).toContain("Platform Overview");
    expect(html).toContain("Get familiar with the main areas");
    expect(html).toContain("Related Help");
    expect(html).toContain("Manage Centres");
    expect(html).toContain('href="/help"');
  });

  it("uses readable article width classes", () => {
    const article = getHelpArticle("platform-overview")!;
    const html = renderToString(<HelpArticleLayout article={article} />);
    expect(html).toContain("max-w-3xl");
  });
});
