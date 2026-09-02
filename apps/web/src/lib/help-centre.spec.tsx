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
