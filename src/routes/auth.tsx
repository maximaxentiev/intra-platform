import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Signed in");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: signUpName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created. You can now sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Ops Portal</h1>
          <p className="text-sm text-muted-foreground">Childcare Staffing — Internal Team</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create your ops team account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required value={signInEmail} onChange={e => setSignInEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input id="si-pass" type="password" required value={signInPassword} onChange={e => setSignInPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Sign in</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" required value={signUpName} onChange={e => setSignUpName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">Password</Label>
                    <Input id="su-pass" type="password" required minLength={6} value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>Create account</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
