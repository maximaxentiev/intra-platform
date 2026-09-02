import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getHelpArticle,
  getHelpArticlesByCategory,
  getRelatedHelpArticles,
  searchHelpArticles,
} from "@/lib/help-articles";

describe("help article registry", () => {
  it("indexes exactly 12 articles", () => {
    expect(HELP_ARTICLES).toHaveLength(12);
  });

  it("defines five Help categories", () => {
    expect(HELP_CATEGORIES).toHaveLength(5);
    expect(HELP_CATEGORIES.map((category) => category.label)).toEqual([
      "Getting Started",
      "Centres & Staff",
      "Individual Shifts",
      "Batch Requests",
      "Reference",
    ]);
  });

  it("groups articles under expected categories", () => {
    expect(getHelpArticlesByCategory("getting-started")).toHaveLength(1);
    expect(getHelpArticlesByCategory("centres-and-staff")).toHaveLength(3);
    expect(getHelpArticlesByCategory("individual-shifts")).toHaveLength(4);
    expect(getHelpArticlesByCategory("batch-requests")).toHaveLength(3);
    expect(getHelpArticlesByCategory("reference")).toHaveLength(1);
  });

  it("looks up articles by slug", () => {
    const article = getHelpArticle("assign-replace-or-unassign-a-carer");
    expect(article?.title).toBe("Assign, Replace or Unassign a Carer");
    expect(getHelpArticle("not-a-real-slug")).toBeUndefined();
  });

  it("searches by title case-insensitively", () => {
    const results = searchHelpArticles("PLATFORM");
    expect(results.some((article) => article.slug === "platform-overview")).toBe(true);
  });

  it("searches by keyword aliases", () => {
    expect(searchHelpArticles("reassign").some((a) => a.slug.includes("assign"))).toBe(true);
    expect(searchHelpArticles("VSC").some((a) => a.slug.includes("documents"))).toBe(true);
    expect(searchHelpArticles("contacted").some((a) => a.slug.includes("assign"))).toBe(true);
    expect(searchHelpArticles("shift notes").some((a) => a.slug.includes("communications"))).toBe(
      true,
    );
  });

  it("returns empty results for blank search", () => {
    expect(searchHelpArticles("")).toEqual([]);
    expect(searchHelpArticles("   ")).toEqual([]);
  });

  it("returns no results for unmatched queries", () => {
    expect(searchHelpArticles("zzzz-not-found-query")).toEqual([]);
  });

  it("resolves related articles without duplicates", () => {
    const related = getRelatedHelpArticles("create-an-individual-shift");
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(4);
    expect(related.some((article) => article.slug === "assign-replace-or-unassign-a-carer")).toBe(
      true,
    );
  });

  it("searches manage-centres keywords", () => {
    expect(searchHelpArticles("primary contact").some((a) => a.slug === "manage-centres")).toBe(
      true,
    );
    expect(searchHelpArticles("top carer").some((a) => a.slug === "manage-centres")).toBe(true);
    expect(searchHelpArticles("ban carer").some((a) => a.slug === "manage-centres")).toBe(true);
    expect(searchHelpArticles("staffpoint").some((a) => a.slug === "manage-centres")).toBe(true);
  });

  it("searches staff profile keywords", () => {
    expect(
      searchHelpArticles("availability").some((a) => a.slug === "manage-staff-profiles-and-availability"),
    ).toBe(true);
    expect(
      searchHelpArticles("portal").some((a) => a.slug === "manage-staff-profiles-and-availability"),
    ).toBe(true);
    expect(
      searchHelpArticles("resend invite").some((a) => a.slug === "manage-staff-profiles-and-availability"),
    ).toBe(true);
    expect(
      searchHelpArticles("centre preferences").some(
        (a) => a.slug === "manage-staff-profiles-and-availability",
      ),
    ).toBe(true);
  });
});

describe("help centre shell wiring", () => {
  it("includes Help in authenticated AppShell navigation", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/AppShell.tsx"), "utf8");
    expect(shell).toContain('to: "/help"');
    expect(shell).toContain('label: "Help"');
  });

  it("defines help landing and article routes", () => {
    const landing = readFileSync(
      join(process.cwd(), "src/routes/_authenticated/help.index.tsx"),
      "utf8",
    );
    const article = readFileSync(
      join(process.cwd(), "src/routes/_authenticated/help.$slug.tsx"),
      "utf8",
    );
    expect(landing).toContain('createFileRoute("/_authenticated/help/")');
    expect(landing).toContain("Find step-by-step instructions");
    expect(article).toContain('createFileRoute("/_authenticated/help/$slug")');
    expect(article).toContain("Help article not found");
  });
});
