import { PageHeader } from "@/components/PageHeader";
import { helpCategoryLabel } from "@/lib/help-articles";
import type { HelpArticle } from "@/lib/help-articles";
import { HelpRelatedArticles } from "@/components/help/HelpRelatedArticles";

export function HelpArticleLayout({ article }: { article: HelpArticle }) {
  const Content = article.Content;

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo="/help"
        backLabel="Back to Help"
        eyebrow={helpCategoryLabel(article.category)}
        title={article.title}
        subtitle={article.summary}
      />

      <div className="space-y-8">
        <Content />
        {article.videoUrl ? (
          <section aria-labelledby="help-video-heading" className="space-y-2">
            <h2 id="help-video-heading" className="text-base font-semibold text-foreground">
              Video
            </h2>
            <a
              href={article.videoUrl}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Watch related video
            </a>
          </section>
        ) : null}
        <HelpRelatedArticles slug={article.slug} />
      </div>
    </article>
  );
}
