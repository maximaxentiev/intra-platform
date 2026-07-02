import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/centres/")({
  component: CentresIndex,
});

function CentresIndex() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => (await db.from("centres").select("*").order("name")).data ?? [],
  });
  const filtered = (data ?? []).filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Centres</h1>
          <p className="text-sm text-muted-foreground">All childcare centres in the directory.</p>
        </div>
        <Button asChild><Link to="/centres/new"><Plus className="h-4 w-4 mr-2" /> Add centre</Link></Button>
      </div>
      <Input placeholder="Search by centre name..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No centres yet. Click "Add centre" to create the first one.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => (
            <Link key={c.id} to="/centres/$id" params={{ id: c.id }}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.address || "No address"}</div>
                <div className="text-xs text-muted-foreground mt-2">{c.contact_name || "No contact"} · {c.preferred_channel}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
