import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, displayStaff } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({
  component: StaffIndex,
});

function StaffIndex() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const { data } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => (await db.from("staff").select("*").order("legal_name")).data ?? [],
  });
  const roles = Array.from(new Set(((data ?? []) as any[]).map(s => s.role).filter(Boolean)));
  const filtered = ((data ?? []) as any[]).filter(s => {
    if (status !== "all" && s.status !== status) return false;
    if (role !== "all" && s.role !== role) return false;
    if (q && !displayStaff(s).toLowerCase().includes(q.toLowerCase()) && !s.legal_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground">Childcare staff directory.</p>
        </div>
        <Button asChild><Link to="/staff/new"><Plus className="h-4 w-4 mr-2" /> Add staff</Link></Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by name..." value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map(r => <SelectItem key={r} value={r as string}>{r as string}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No staff match your filters.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any) => (
            <Link key={s.id} to="/staff/$id" params={{ id: s.id }}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{displayStaff(s)}</div>
                  <Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{s.role || "No role"}</div>
                <div className="text-xs text-muted-foreground">{s.phone || s.email || "No contact"}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
