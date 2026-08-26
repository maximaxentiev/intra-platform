import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Deliberate back-navigation control.
 * Always rendered as a real button so it never reads as loose text.
 */
export function BackLink({
  to,
  params,
  search,
  label,
  className,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  label: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 rounded-lg px-2.5 font-medium text-muted-foreground", className)}
    >
      <Link to={to as never} params={params as never} search={search as never}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
