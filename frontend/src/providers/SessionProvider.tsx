import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { requestSessionRefresh } from "@/lib/api";

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { clearAuth, markAuthChecked } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // A cached profile is enough to open the local workspace while offline.
        // Avoid waiting for a network request that cannot succeed.
        if (!navigator.onLine) return;
        await requestSessionRefresh();
      } catch (error: unknown) {
        const authError = error as { response?: { status?: number } };
        if ([401, 403].includes(authError.response?.status ?? 0)) {
          clearAuth();
        }
      } finally {
        markAuthChecked();
      }
    };
    void initAuth();
  }, [clearAuth, markAuthChecked]);

  return <>{children}</>;
};
