// @vitest-environment ./vitest-minimal-dom

import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HelpBeforeYouContinueCallout } from "@/components/help/HelpBeforeYouContinueCallout";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpScreenshot } from "@/components/help/HelpScreenshot";
import { HelpArticleLayout } from "@/components/help/HelpArticleLayout";
import { HelpSearchInput } from "@/components/help/HelpSearchInput";
import { getHelpArticle } from "@/lib/help-articles";

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

  it("renders search input with accessible label", () => {
    const html = renderToString(<HelpSearchInput value="" onChange={() => {}} />);
    expect(html).toContain("Search Help");
  });
});

describe("help article page layout", () => {
  it("renders demo article content and related links", () => {
    const article = getHelpArticle("platform-overview");
    expect(article).toBeDefined();

    const html = renderToString(<HelpArticleLayout article={article!} />);
    expect(html).toContain("Platform Overview");
    expect(html).toContain("Detailed instructions and screenshots");
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
