import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  meta?: ReactNode; // small chips / badges shown next to title
};

/**
 * Uniform page header used on every route.
 * - Prominent back button that clearly looks clickable
 * - Clear title + optional subtitle
 * - Primary/secondary actions grouped to the right
 * - Responsive: stacks on mobile, actions wrap without clipping
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  backTo,
  backLabel = "Back",
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <header className="space-y-4">
      {backTo && (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2.5 font-medium text-muted-foreground"
        >
          <Link to={backTo as any}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {backLabel}
          </Link>
        </Button>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
            <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-foreground break-words">
              {title}
            </h1>
            {meta}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}
