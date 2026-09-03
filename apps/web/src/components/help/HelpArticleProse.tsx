import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Help article body typography. Uses explicit descendant selectors — not Tailwind
 * Typography `prose-*` (the typography plugin is not installed in this project).
 */
export function HelpArticleProse({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "help-article-prose max-w-none text-base text-foreground",
        "[&_h2]:scroll-mt-24 [&_h2]:mt-12 [&_h2]:mb-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
        "[&_h3]:scroll-mt-24 [&_h3]:mt-9 [&_h3]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-foreground",
        "[&_p]:my-4 [&_p]:leading-7 [&_p]:text-muted-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
        "[&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-7 [&_ul]:marker:text-muted-foreground",
        "[&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-7 [&_ol]:marker:text-muted-foreground",
        "[&_li]:my-2 [&_li]:pl-1 [&_li]:leading-7 [&_li]:text-muted-foreground",
        "[&_li>ul]:mt-2 [&_li>ul]:mb-1 [&_li>ol]:mt-2 [&_li>ol]:mb-1",
        "[&_table]:my-8 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:text-foreground",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_td]:text-muted-foreground",
        "[&>aside]:my-8 [&>figure]:my-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
