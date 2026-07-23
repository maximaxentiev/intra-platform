import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OpsUserRow = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  invited_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
};

export const listOpsUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpsUserRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: any[] = [];
    let page = 1;
    // paginate defensively
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...data.users);
      if (data.users.length < 200) break;
      page++;
      if (page > 20) break;
    }
    const ids = users.map((u) => u.id);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name as string]));
    return users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: nameById.get(u.id) ?? (u.user_metadata?.full_name ?? ""),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      invited_at: u.invited_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      banned_until: (u as any).banned_until ?? null,
    }));
  });

export const inviteOpsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; full_name?: string; redirect_origin: string }) => {
    if (!data?.email || !/^\S+@\S+\.\S+$/.test(data.email)) throw new Error("Please enter a valid email address");
    if (!data.redirect_origin) throw new Error("Missing redirect origin");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name ?? "" },
      redirectTo: `${data.redirect_origin}/auth`,
    });
    if (error) throw new Error(error.message);
    return { id: res.user?.id ?? null };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; email: string; redirect_origin: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${data.redirect_origin}/auth`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOpsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account here.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
