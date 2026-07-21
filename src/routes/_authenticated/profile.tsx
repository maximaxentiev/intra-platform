import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      setEmail(u.user.email ?? "");
      const { data } = await db.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (data) { setName(data.full_name ?? ""); setEmail(data.email ?? u.user.email ?? ""); }
      setLoading(false);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const { error } = await db.from("profiles").upsert({ id: userId, full_name: name, email });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <DetailLoading />;
  return (
    <div className="max-w-lg space-y-6">
      <PageHeader
        title="My profile"
        subtitle="Update your name and contact email."
      />
      <Card className="border-border/70 shadow-xs">
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>Save changes</Button>
              <Button type="button" variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
