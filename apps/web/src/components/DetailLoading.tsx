import { Skeleton } from "@/components/ui/skeleton";

export function DetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 md:col-span-1" />
        <Skeleton className="h-40 md:col-span-2" />
      </div>
    </div>
  );
}
