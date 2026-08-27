import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authApi } from "@/lib/db";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await authApi.session();
      if (user.mustChangePassword) {
        throw redirect({ to: "/auth/change-password", replace: true });
      }
      return { user };
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
