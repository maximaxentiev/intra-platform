import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { centresApi, channelLabel } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Building2, Search, MapPin, User, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/centres/")({
  component: CentresIndex,
});

function CentresIndex() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["centres"],
    queryFn: () => centresApi.list(),
  });
  const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centres"
        subtitle="All childcare centres in the directory."
        actions={
          <Button asChild size="default">
            <Link to="/centres/new"><Plus className="h-4 w-4 mr-1.5" /> Add centre</Link>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by centre name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-10"
          aria-label="Search centres"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyCentres searched={!!q} />
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {(data ?? []).length} centres
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <Link key={c.id} to="/centres/$id" params={{ id: c.id }} className="group min-w-0">
                <Card className="h-full p-4 border-border/70 shadow-xs transition-all group-hover:border-primary/40 group-hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] text-foreground truncate">{c.name}</div>
                      <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className="truncate">{c.address || "No address on file"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.primaryContactName || "No primary contact"}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/70 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground uppercase tracking-wider font-medium">Preferred contact</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                      {channelLabel(c.primaryChannel)}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyCentres({ searched }: { searched: boolean }) {
  return (
    <Card className="p-12 text-center border-dashed bg-surface-muted">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
        <Building2 className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        {searched ? "No centres match your search" : "No centres yet"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {searched
          ? "Try a different name, or clear the search."
          : "Add the first centre to start scheduling shifts."}
      </p>
      {!searched && (
        <Button asChild className="mt-4">
          <Link to="/centres/new"><Plus className="h-4 w-4 mr-1.5" /> Add centre</Link>
        </Button>
      )}
    </Card>
  );
}
