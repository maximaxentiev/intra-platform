import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HelpArticleProse({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm sm:prose-base max-w-none text-foreground",
        "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-h2:mt-10 prose-h2:mb-4",
        "prose-h3:mt-8 prose-h3:mb-3",
        "prose-p:my-3 prose-p:leading-relaxed prose-p:text-muted-foreground",
        "prose-strong:text-foreground",
        "prose-ol:my-4 prose-ul:my-4 prose-ol:pl-6 prose-ul:pl-6",
        "prose-li:my-1.5 prose-li:leading-relaxed prose-li:text-muted-foreground",
        "prose-li:marker:text-muted-foreground/80",
        "prose-li>ul:mt-2 prose-li>ol:mt-2",
        "prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-table:my-6",
        "[&>aside]:my-6 [&>figure]:my-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
