import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { HelpArticleCard } from "@/components/help/HelpArticleCard";
import { HelpSearchInput } from "@/components/help/HelpSearchInput";
import {
  HELP_CATEGORIES,
  getHelpArticlesByCategory,
  searchHelpArticles,
} from "@/lib/help-articles";

export const Route = createFileRoute("/_authenticated/help/")({
  component: HelpLandingPage,
});

function HelpLandingPage() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const searchActive = trimmedQuery.length > 0;

  const searchResults = useMemo(
    () => (searchActive ? searchHelpArticles(trimmedQuery) : []),
    [searchActive, trimmedQuery],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help"
        subtitle="Find step-by-step instructions for common tasks in the Intra platform."
      />

      <HelpSearchInput value={query} onChange={setQuery} />

      {searchActive ? (
        <section aria-labelledby="help-search-results-heading" className="space-y-4">
          <h2 id="help-search-results-heading" className="text-lg font-semibold text-foreground">
            Search results
          </h2>
          {searchResults.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No matching Help articles</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try keywords such as assign, cancel batch, documents, priority, or shift notes.
              </p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResults.map((article) => (
                <HelpArticleCard key={article.slug} article={article} showCategory />
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {HELP_CATEGORIES.map((category) => {
            const articles = getHelpArticlesByCategory(category.id);
            if (articles.length === 0) return null;

            return (
              <section key={category.id} aria-labelledby={`help-category-${category.id}`}>
                <h2
                  id={`help-category-${category.id}`}
                  className="text-lg font-semibold text-foreground"
                >
                  {category.label}
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {articles.map((article) => (
                    <HelpArticleCard key={article.slug} article={article} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Not sure where to start? Use search above or begin with the{" "}
        <Link to="/help/$slug" params={{ slug: "platform-overview" }} className="text-primary hover:underline">
          Platform Overview
        </Link>
        . For terminology and communication choices, see{" "}
        <Link
          to="/help/$slug"
          params={{ slug: "communications-notes-and-important-terminology" }}
          className="text-primary hover:underline"
        >
          Communications, Notes &amp; Important Terminology
        </Link>
        .
      </p>
    </div>
  );
}
