import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HelpArticleProse({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm sm:prose-base max-w-none text-foreground",
        "prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-p:text-muted-foreground prose-li:text-muted-foreground",
        "prose-ol:text-muted-foreground prose-ul:text-muted-foreground",
        "prose-strong:text-foreground",
        "prose-table:block prose-table:w-full prose-table:overflow-x-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
