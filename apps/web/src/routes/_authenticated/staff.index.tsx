import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { staffApi, displayStaff, type Staff, type PortalAccountDisplayStatus } from "@/lib/db";
import { PORTAL_ACCOUNT_STATUS_LABELS } from "@/lib/portal-account-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PortalStatusBadge } from "@/components/PortalStatusBadge";
import { Plus, Users, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffIndex,
});

const PORTAL_FILTER_OPTIONS: PortalAccountDisplayStatus[] = [
  "no_account",
  "invited",
  "incomplete",
  "active",
  "disabled",
];

function portalStatusOf(s: Staff): PortalAccountDisplayStatus {
  return (s.portalAccountStatus ?? "no_account") as PortalAccountDisplayStatus;
}

function StaffIndex() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [portal, setPortal] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });
  const list: Staff[] = data ?? [];
  const roles = Array.from(new Set(list.map((s) => s.role).filter(Boolean))).sort();
  const filtered = list.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (role !== "all" && s.role !== role) return false;
    if (portal !== "all" && portalStatusOf(s) !== portal) return false;
    if (
      q &&
      !displayStaff(s).toLowerCase().includes(q.toLowerCase()) &&
      !s.legalName.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });
  const hasFilters = q !== "" || status !== "all" || role !== "all" || portal !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Childcare staff directory."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/staff/import">Import CSV</Link>
            </Button>
            <Button asChild>
              <Link to="/staff/new"><Plus className="h-4 w-4 mr-1.5" /> Add staff</Link>
            </Button>
          </div>
        }
      />

      <Card className="p-3 sm:p-4 border-border/70 shadow-xs">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_12rem_12rem] items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-10"
              aria-label="Search staff"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10" aria-label="Filter by employment status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-10" aria-label="Filter by role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r as string} value={r as string}>{r as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portal} onValueChange={setPortal}>
            <SelectTrigger className="h-10" aria-label="Filter by portal account status">
              <SelectValue placeholder="Portal account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All portal statuses</SelectItem>
              {PORTAL_FILTER_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>{PORTAL_ACCOUNT_STATUS_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed bg-surface-muted">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold">
            {hasFilters ? "No staff match your filters" : "No staff yet"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters ? "Adjust or clear filters to see more results." : "Add your first staff member to get started."}
          </p>
          {!hasFilters && (
            <Button asChild className="mt-4">
              <Link to="/staff/new"><Plus className="h-4 w-4 mr-1.5" /> Add staff</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {list.length} staff
          </div>

          {/* Desktop table — lg+ only; seven columns are too dense below that width */}
          <Card className="hidden lg:block border-border/70 shadow-xs overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium w-28">Role</th>
                  <th className="px-3 py-2 font-medium w-40">Phone</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium w-32">Employment</th>
                  <th className="px-3 py-2 font-medium w-36">Portal account</th>
                  <th className="px-3 py-2 font-medium w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2 max-w-[16rem]">
                      <Link
                        to="/staff/$id"
                        params={{ id: s.id }}
                        className="font-medium hover:text-primary hover:underline block truncate"
                        title={displayStaff(s)}
                      >
                        {displayStaff(s)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {s.role ? s.role : <span className="text-muted-foreground italic">No role assigned</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {s.phone || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[18rem]">
                      {s.email ? (
                        <>
                          <span className="block truncate" title={s.email} aria-hidden>
                            {s.email}
                          </span>
                          <span className="sr-only">{s.email}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status === "active" ? "active" : "inactive"} size="xs">
                        {s.status}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        aria-label={`Portal account: ${PORTAL_ACCOUNT_STATUS_LABELS[portalStatusOf(s)]}`}
                      >
                        <PortalStatusBadge status={portalStatusOf(s)} size="xs" />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                        <Link to="/staff/$id" params={{ id: s.id }}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile / tablet list */}
          <div className="lg:hidden space-y-2">
            {filtered.map((s) => (
              <Card key={s.id} className="p-3 border-border/70 shadow-xs">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <Link
                      to="/staff/$id"
                      params={{ id: s.id }}
                      className="font-semibold text-[15px] hover:text-primary block truncate"
                    >
                      {displayStaff(s)}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.role || "No role assigned"}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 h-9">
                    <Link to="/staff/$id" params={{ id: s.id }}>View</Link>
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={s.status === "active" ? "active" : "inactive"} size="xs">
                    {s.status}
                  </StatusBadge>
                  <PortalStatusBadge status={portalStatusOf(s)} size="xs" />
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-muted-foreground min-w-0">
                  <div className="break-words">{s.phone || "No phone"}</div>
                  <div className="break-all">{s.email || "No email"}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
