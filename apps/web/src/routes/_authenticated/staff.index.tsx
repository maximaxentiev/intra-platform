import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { staffApi, displayStaff, type Staff, type PortalAccountDisplayStatus } from "@/lib/db";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  portalStatusBadgeVariant,
} from "@/lib/portal-account-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Plus, Users, Search, Phone, Mail, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffIndex,
});

function StaffIndex() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });
  const list: Staff[] = data ?? [];
  const roles = Array.from(new Set(list.map((s) => s.role).filter(Boolean)));
  const filtered = list.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (role !== "all" && s.role !== role) return false;
    if (
      q &&
      !displayStaff(s).toLowerCase().includes(q.toLowerCase()) &&
      !s.legalName.toLowerCase().includes(q.toLowerCase())
    )
      return false;
    return true;
  });
  const hasFilters = q !== "" || status !== "all" || role !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Childcare staff directory."
        actions={
          <Button asChild>
            <Link to="/staff/new"><Plus className="h-4 w-4 mr-1.5" /> Add staff</Link>
          </Button>
        }
      />

      <Card className="p-3 sm:p-4 border-border/70 shadow-xs">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_14rem] items-center">
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
            <SelectTrigger className="h-10"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r as string} value={r as string}>{r as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
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
        <>
          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {list.length} staff
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Link key={s.id} to="/staff/$id" params={{ id: s.id }} className="group">
                <Card className="h-full p-4 border-border/70 shadow-xs transition-all group-hover:border-primary/40 group-hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] truncate">{displayStaff(s)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">{s.role || "No role assigned"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={s.status === "active" ? "active" : "inactive"}>{s.status}</StatusBadge>
                      <Badge
                        variant={portalStatusBadgeVariant(
                          (s.portalAccountStatus ?? "no_account") as PortalAccountDisplayStatus,
                        )}
                        className="text-[10px]"
                      >
                        {
                          PORTAL_ACCOUNT_STATUS_LABELS[
                            (s.portalAccountStatus ?? "no_account") as PortalAccountDisplayStatus
                          ]
                        }
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/70 flex items-center gap-3 text-xs text-muted-foreground">
                    {s.phone && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Phone className="h-3.5 w-3.5" />{s.phone}
                      </span>
                    )}
                    {s.email && !s.phone && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="h-3.5 w-3.5" />{s.email}
                      </span>
                    )}
                    {!s.phone && !s.email && <span className="italic">No contact info</span>}
                    <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
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
