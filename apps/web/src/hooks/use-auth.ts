import { useQuery } from "@tanstack/react-query";
import { authApi, type CurrentUser } from "@/lib/db";
import { ApiError } from "@/lib/api";

// Session-cookie auth: ask the API who we are. 401 => not signed in.
export function useAuth() {
  const query = useQuery<CurrentUser | null>({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      try {
        return await authApi.session();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  return { user: query.data ?? null, loading: query.isLoading };
}
