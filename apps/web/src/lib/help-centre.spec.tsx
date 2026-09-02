// @vitest-environment ./vitest-minimal-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
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
