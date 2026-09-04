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

  it("searches staff documents keywords", () => {
    expect(
      searchHelpArticles("VSC").some((a) => a.slug === "review-and-approve-staff-documents"),
    ).toBe(true);
    expect(
      searchHelpArticles("approve document").some((a) => a.slug === "review-and-approve-staff-documents"),
    ).toBe(true);
    expect(
      searchHelpArticles("pending review").some((a) => a.slug === "review-and-approve-staff-documents"),
    ).toBe(true);
    expect(
      searchHelpArticles("RECE proof").some((a) => a.slug === "review-and-approve-staff-documents"),
    ).toBe(true);
    expect(
      searchHelpArticles("expired").some((a) => a.slug === "review-and-approve-staff-documents"),
    ).toBe(true);
  });

  it("searches create shift keywords", () => {
    expect(
      searchHelpArticles("create shift").some((a) => a.slug === "create-an-individual-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("new shift").some((a) => a.slug === "create-an-individual-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("Staffpoint").some((a) => a.slug === "create-an-individual-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("Shift Notes").some((a) => a.slug === "create-an-individual-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("RECE").some((a) => a.slug === "create-an-individual-shift"),
    ).toBe(true);
  });

  it("searches available staff keywords", () => {
    expect(
      searchHelpArticles("priority").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
    expect(
      searchHelpArticles("available staff").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
    expect(
      searchHelpArticles("contacted").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
    expect(
      searchHelpArticles("banned staff").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
    expect(
      searchHelpArticles("RECE proof").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
    expect(
      searchHelpArticles("overlap").some((a) => a.slug === "understand-available-staff-and-priority"),
    ).toBe(true);
  });

  it("searches assignment keywords", () => {
    expect(
      searchHelpArticles("assign carer").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
    expect(
      searchHelpArticles("contacted").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
    expect(
      searchHelpArticles("replace carer").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
    expect(
      searchHelpArticles("reassign").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
    expect(
      searchHelpArticles("unassign").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
    expect(
      searchHelpArticles("resend confirmation").some((a) => a.slug === "assign-replace-or-unassign-a-carer"),
    ).toBe(true);
  });

  it("searches edit and cancel shift keywords", () => {
    expect(
      searchHelpArticles("edit shift").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("change schedule").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("unavailable carer").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("availability confirmed").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("cancel shift").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("cancellation reason").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
    expect(
      searchHelpArticles("delete shift").some((a) => a.slug === "edit-or-cancel-a-shift"),
    ).toBe(true);
  });

  it("searches create batch keywords", () => {
    expect(
      searchHelpArticles("create batch").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("batch request").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("multiple shifts").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("duplicate shift").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("internal comment").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("remove shift").some((a) => a.slug === "create-a-batch-request"),
    ).toBe(true);
  });

  it("searches batch fulfillment keywords", () => {
    expect(
      searchHelpArticles("fill batch").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("complete request").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("batch confirmation").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("updates required").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("ready to send updates").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("send updates").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
    expect(
      searchHelpArticles("what changed").some((a) => a.slug === "fill-complete-and-update-a-batch-request"),
    ).toBe(true);
  });

  it("finds cancel batch article by operational search terms", () => {
    for (const query of [
      "cancel batch",
      "batch cancellation",
      "centre cancellation",
      "carer cancellation",
      "cancellation reason",
      "cancel entire batch",
    ]) {
      expect(searchHelpArticles(query).some((a) => a.slug === "cancel-a-batch-request")).toBe(true);
    }
  });

  it("finds communications reference article by operational search terms", () => {
    for (const query of [
      "shift notes",
      "internal comment",
      "internal ops notes",
      "centre rules",
      "carer email",
      "pending",
      "updates required",
      "contacted",
      "staffpoint",
      "RECE",
      "review centre email",
      "customize email",
      "legal name",
      "display name",
      "onboarding reminder",
      "shift history",
    ]) {
      expect(
        searchHelpArticles(query).some((a) => a.slug === "communications-notes-and-important-terminology"),
      ).toBe(true);
    }
  });

  it("finds product improvement search terms in expected articles", () => {
    const cases: Array<[string, string]> = [
      ["internal ops notes", "manage-centres"],
      ["shift history", "manage-centres"],
      ["email shift history", "manage-centres"],
      ["onboarding reminder", "manage-staff-profiles-and-availability"],
      ["onboarding incomplete", "manage-staff-profiles-and-availability"],
      ["next two weeks", "manage-staff-profiles-and-availability"],
      ["review centre email", "assign-replace-or-unassign-a-carer"],
      ["customize email", "assign-replace-or-unassign-a-carer"],
      ["legal name", "communications-notes-and-important-terminology"],
      ["display name", "communications-notes-and-important-terminology"],
    ];
    for (const [query, slug] of cases) {
      expect(searchHelpArticles(query).some((a) => a.slug === slug)).toBe(true);
    }
  });
});

describe("help V1 content completeness", () => {
  const EXPECTED_SLUGS = [
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

  it("defines all 12 planned V1 article slugs", () => {
    expect(HELP_ARTICLES.map((article) => article.slug).sort()).toEqual([...EXPECTED_SLUGS].sort());
  });

  it("resolves related slugs for every article", () => {
    for (const slug of EXPECTED_SLUGS) {
      const article = getHelpArticle(slug);
      expect(article).toBeDefined();
      expect(article!.relatedSlugs.length).toBeGreaterThan(0);
      expect(article!.relatedSlugs.length).toBeLessThanOrEqual(4);
      expect(new Set(article!.relatedSlugs).size).toBe(article!.relatedSlugs.length);
      expect(article!.relatedSlugs).not.toContain(slug);
      for (const relatedSlug of article!.relatedSlugs) {
        expect(getHelpArticle(relatedSlug)).toBeDefined();
      }
    }
  });

  it("finds representative operational searches across V1 articles", () => {
    const cases: Array<[string, string]> = [
      ["create shift", "create-an-individual-shift"],
      ["staffpoint", "create-an-individual-shift"],
      ["approve document", "review-and-approve-staff-documents"],
      ["availability", "manage-staff-profiles-and-availability"],
      ["contacted", "understand-available-staff-and-priority"],
      ["replace carer", "assign-replace-or-unassign-a-carer"],
      ["cancel shift", "edit-or-cancel-a-shift"],
      ["create batch", "create-a-batch-request"],
      ["complete request", "fill-complete-and-update-a-batch-request"],
      ["cancel batch", "cancel-a-batch-request"],
      ["shift notes", "communications-notes-and-important-terminology"],
      ["internal comment", "communications-notes-and-important-terminology"],
    ];
    for (const [query, slug] of cases) {
      expect(searchHelpArticles(query).some((a) => a.slug === slug)).toBe(true);
    }
  });

  it("finds common Ops search queries from the V1 review list", () => {
    const cases: Array<[string, string]> = [
      ["create shift", "create-an-individual-shift"],
      ["new shift", "create-an-individual-shift"],
      ["assign carer", "assign-replace-or-unassign-a-carer"],
      ["replace carer", "assign-replace-or-unassign-a-carer"],
      ["remove carer", "assign-replace-or-unassign-a-carer"],
      ["unavailable", "edit-or-cancel-a-shift"],
      ["priority", "understand-available-staff-and-priority"],
      ["contacted", "understand-available-staff-and-priority"],
      ["documents", "review-and-approve-staff-documents"],
      ["VSC", "review-and-approve-staff-documents"],
      ["availability", "manage-staff-profiles-and-availability"],
      ["centre contact", "manage-centres"],
      ["top staff", "manage-centres"],
      ["banned", "manage-centres"],
      ["create batch", "create-a-batch-request"],
      ["complete request", "fill-complete-and-update-a-batch-request"],
      ["batch update", "fill-complete-and-update-a-batch-request"],
      ["cancel batch", "cancel-a-batch-request"],
      ["shift notes", "communications-notes-and-important-terminology"],
      ["internal comment", "communications-notes-and-important-terminology"],
      ["staffpoint", "create-an-individual-shift"],
    ];
    for (const [query, slug] of cases) {
      expect(searchHelpArticles(query).some((a) => a.slug === slug)).toBe(true);
    }
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
    expect(landing).toContain("communications-notes-and-important-terminology");
    expect(landing).toContain("Communications, Notes &amp; Important Terminology");
    expect(article).toContain('createFileRoute("/_authenticated/help/$slug")');
    expect(article).toContain("Help article not found");
  });
});
