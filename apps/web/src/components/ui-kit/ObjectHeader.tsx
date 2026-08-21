import { Link } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Detail-screen header for a single object (Staff, Centre, Shift).
 * Builds on the same rhythm as PageHeader, adding meta pills, supporting
 * information and an overflow menu for secondary/destructive actions.
 */
export function ObjectHeader({
  title,
  eyebrow,
  meta,
  supporting,
  backTo,
  backParams,
  backLabel = "Back",
  actions,
  overflow,
  overflowLabel = "More actions",
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Status / identity pills shown beside the title. */
  meta?: ReactNode;
  /** Secondary line(s) of supporting information. */
  supporting?: ReactNode;
  backTo?: string;
  backParams?: Record<string, string>;
  backLabel?: string;
  /** Primary + secondary buttons. Keep to two visible actions where possible. */
  actions?: ReactNode;
  /** Menu items for the overflow menu (destructive actions belong here). */
  overflow?: ReactNode;
  overflowLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      {backTo && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Link to={backTo as never} params={backParams as never}>
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {title}
            </h1>
            {meta}
          </div>
          {supporting && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {supporting}
            </div>
          )}
        </div>

        {(actions || overflow) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {overflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={overflowLabel}>
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {overflow}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
