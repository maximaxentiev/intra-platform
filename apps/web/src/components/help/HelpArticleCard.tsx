import { Link } from "@tanstack/react-router";
import { helpCategoryLabel } from "@/lib/help-articles";
import type { HelpArticleMeta } from "@/lib/help-articles";
import { cn } from "@/lib/utils";

export function HelpArticleCard({
  article,
  showCategory = false,
  className,
}: {
  article: HelpArticleMeta;
  showCategory?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/help/$slug"
      params={{ slug: article.slug }}
      className={cn(
        "block rounded-lg border border-border/70 bg-card px-4 py-3 shadow-xs transition hover:border-border hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {showCategory ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {helpCategoryLabel(article.category)}
        </p>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{article.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
    </Link>
  );
}
