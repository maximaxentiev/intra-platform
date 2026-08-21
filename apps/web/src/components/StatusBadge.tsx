import type { ReactNode } from "react";
import { StatusPill, type StatusPillSize } from "@/components/ui-kit/StatusPill";

/**
 * Backwards-compatible wrapper around the shared StatusPill primitive.
 * New code should import StatusPill from `@/components/ui-kit` directly.
 */
export function StatusBadge({
  status,
  children,
  className,
  showIcon = true,
  size = "sm",
}: {
  status: string;
  children?: ReactNode;
  className?: string;
  showIcon?: boolean;
  size?: StatusPillSize;
}) {
  return (
    <StatusPill status={status} className={className} showIcon={showIcon} size={size}>
      {children}
    </StatusPill>
  );
}
