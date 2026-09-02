import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpArticleLayout } from "@/components/help/HelpArticleLayout";
import { getHelpArticle } from "@/lib/help-articles";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/help/$slug")({
  component: HelpArticlePage,
});

function HelpArticlePage() {
  const { slug } = Route.useParams();
  const article = getHelpArticle(slug);

  if (!article) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Help article not found</h1>
        <p className="text-sm text-muted-foreground">
          We could not find a Help article for <span className="font-medium text-foreground">{slug}</span>.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/help">Back to Help</Link>
        </Button>
      </div>
    );
  }

  return <HelpArticleLayout article={article} />;
}
