import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type HelpCalloutVariant = "important" | "info";

const VARIANT_STYLES: Record<HelpCalloutVariant, string> = {
  important: "border-warning/40 bg-warning-soft/40",
  info: "border-border/70 bg-muted/40",
};

export function HelpCallout({
  title,
  variant = "important",
  children,
}: {
  title: string;
  variant?: HelpCalloutVariant;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn("my-8 rounded-lg border px-4 py-4 not-prose", VARIANT_STYLES[variant])}
      role="note"
      aria-label={title}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-1 text-sm text-muted-foreground [&_p]:mt-1">{children}</div>
    </aside>
  );
}
