import { createFileRoute } from "@tanstack/react-router";
import { PublicDocumentSharePage } from "@/components/public/PublicDocumentSharePage";

export const Route = createFileRoute("/documents/$slug")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shared documents · Intra" },
      {
        name: "description",
        content: "View shared compliance documents for verification purposes.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PublicDocumentShareRoute,
});

function PublicDocumentShareRoute() {
  const { slug } = Route.useParams();
  return <PublicDocumentSharePage slug={slug} />;
}
