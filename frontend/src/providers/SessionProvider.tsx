import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { requestSessionRefresh } from "@/lib/api";
import { initializeConnectivity, isOnline } from "@/lib/connectivity";

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { clearAuth, markAuthChecked, markOfflineSession } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        await initializeConnectivity();

        // A cached profile is enough to open the local workspace while offline.
        // Avoid waiting for a network request that cannot succeed.
        if (!isOnline()) {
          if (useAuthStore.getState().user) {
            markOfflineSession();
          }
          return;
        }

        await requestSessionRefresh();
      } catch (error: unknown) {
        const authError = error as {
          response?: { status?: number };
          code?: string;
        };
        const status = authError.response?.status;

        if ([401, 403].includes(status ?? 0)) {
          const hadPreviousUser = Boolean(useAuthStore.getState().user);
          clearAuth();
          if (hadPreviousUser) {
            import("sonner").then(({ toast }) => {
              toast.error("Session expired. Please log in again.", {
                id: "session-expired",
              });
            });
          }
        } else if (!authError.response) {
          // Network failure / timeout: keep the cached profile so the local
          // workspace can be used offline, just like the Electron app.
          if (useAuthStore.getState().user) {
            markOfflineSession();
          }
        }
      } finally {
        if (!cancelled) markAuthChecked();
      }
    };

    void initAuth();

    return () => {
      cancelled = true;
    };
  }, [clearAuth, markAuthChecked, markOfflineSession]);

  return <>{children}</>;
};
