import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function HelpBeforeYouContinueCallout({
  title = "Before you continue",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className="my-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3.5 not-prose"
      role="note"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <div className="mt-1 text-sm text-muted-foreground [&_p]:mt-1">{children}</div>
        </div>
      </div>
    </aside>
  );
}
