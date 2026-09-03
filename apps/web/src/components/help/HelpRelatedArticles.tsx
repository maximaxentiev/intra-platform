import { HelpArticleCard } from "@/components/help/HelpArticleCard";
import { getRelatedHelpArticles } from "@/lib/help-articles";

export function HelpRelatedArticles({ slug }: { slug: string }) {
  const related = getRelatedHelpArticles(slug);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="help-related-heading" className="mt-10 space-y-4 border-t border-border pt-10">
      <h2 id="help-related-heading" className="text-base font-semibold text-foreground">
        Related Help
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {related.map((article) => (
          <HelpArticleCard key={article.slug} article={article} showCategory />
        ))}
      </div>
    </section>
  );
}
