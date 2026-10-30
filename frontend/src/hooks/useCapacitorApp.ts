import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Browser } from "@capacitor/browser";
import { Keyboard } from "@capacitor/keyboard";
import { Preferences } from "@capacitor/preferences";
import { getCodeVerifier, clearCodeVerifier } from "@/utils/pkce";
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { triggerSelectionHaptic } from "@/utils/haptics";

export function useCapacitorApp() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run on native mobile platforms (Android/iOS) — safely no-ops on Web & Electron
    if (!Capacitor.isNativePlatform()) return;

    // 1. Tag document root for any mobile native CSS rules (e.g. safe-area tweaks)
    document.documentElement.classList.add("is-capacitor");

    // Android dispatches this after a true long press has opened its context menu.
    // Keeping this global makes the feedback consistent for every long-press menu.
    const handleContextMenu = () => triggerSelectionHaptic();
    document.addEventListener("contextmenu", handleContextMenu);

    // 2. Synchronize Status Bar styling with current theme (Light font on dark, Dark font on light)
    const syncStatusBarWithTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        void StatusBar.setBackgroundColor({ color: "#09090b" }).catch(() => {});
      } else {
        void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
        void StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(() => {});
      }
    };

    syncStatusBarWithTheme();

    const themeObserver = new MutationObserver(() => {
      syncStatusBarWithTheme();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    void StatusBar.getInfo()
      .then((info) => {
        if (info?.height && typeof info.height === "number" && info.height > 0) {
          document.documentElement.style.setProperty("--status-bar-height", `${info.height}px`);
        }
      })
      .catch(() => {});

    // The Android keyboard overlays the WebView, so bottom-pinned controls
    // need the native keyboard height to move above it.
    let keyboardAnimationTimer: number | undefined;
    const setKeyboardOffset = (height: number) => {
      const offset = Math.max(0, height);
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
      document.documentElement.classList.toggle("keyboard-open", offset > 0);
      document.documentElement.classList.add("keyboard-transitioning");
      if (keyboardAnimationTimer !== undefined) window.clearTimeout(keyboardAnimationTimer);
      keyboardAnimationTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("keyboard-transitioning");
      }, 280);
      window.dispatchEvent(new CustomEvent<number>("notesify:keyboard-offset", { detail: offset }));
    };
    const keyboardShowListener = Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
      setKeyboardOffset(keyboardHeight);
    });
    const keyboardHideListener = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardOffset(0);
    });

    // 3. Deep link listener (handles notesify://, notesify://callback, and https://notesify.in)
    const urlListenerPromise = CapApp.addListener("appUrlOpen", async (event) => {
      try {
        const rawUrl = event.url;

        // Special handling for OAuth callback (notesify://callback?code=...)
        if (rawUrl.startsWith("notesify://callback")) {
          // Close the external system browser tab
          void Browser.close().catch(() => {});

          const parsedUrl = new URL(rawUrl);
          const code = parsedUrl.searchParams.get("code");
          const code_verifier = getCodeVerifier();

          if (!code || !code_verifier) {
            toast.error("Google authentication failed: missing credentials");
            navigate("/login", { replace: true });
            return;
          }

          try {
            const res = await api.post("/users/exchange-code", { code, code_verifier });
            if (res.data?.refreshToken) {
              await Preferences.set({ key: "refreshToken", value: res.data.refreshToken });
            }

            useAuthStore.getState().setAuth(
              {
                id: res.data.user.id || res.data.user._id,
                name: res.data.user.name,
                email: res.data.user.email,
                avatar: res.data.user.avatar,
                isVerified: res.data.user.isVerified,
              },
              res.data.accessToken
            );

            clearCodeVerifier();
            toast.success("Signed in successfully!");
            navigate("/", { replace: true });
            return;
          } catch (err: any) {
            console.error("[Capacitor] OAuth exchange failed:", err);
            toast.error(err?.response?.data?.message || "Google sign in failed");
            navigate("/login", { replace: true });
            return;
          }
        }

        // Standard deep links (e.g. notesify://shared/abc or https://notesify.in/shared/abc)
        let route = "";
        if (rawUrl.startsWith("notesify://")) {
          const stripped = rawUrl.replace(/^notesify:\/\/?/, "");
          route = stripped.startsWith("/") ? stripped : `/${stripped}`;
        } else if (rawUrl.startsWith("http")) {
          const parsed = new URL(rawUrl);
          route = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }

        if (route) {
          navigate(route);
        }
      } catch (err) {
        console.warn("[Capacitor] Deep link error:", err);
      }
    });

    // 4. Android Hardware Back Button listener
    const backListenerPromise = CapApp.addListener("backButton", ({ canGoBack }) => {
      const isRoot = location.pathname === "/" || location.pathname === "/login";
      if (!isRoot && canGoBack) {
        navigate(-1);
      } else {
        void CapApp.exitApp();
      }
    });

    return () => {
      themeObserver.disconnect();
      void urlListenerPromise.then((handle) => handle.remove());
      void backListenerPromise.then((handle) => handle.remove());
      void keyboardShowListener.then((handle) => handle.remove());
      void keyboardHideListener.then((handle) => handle.remove());
      document.documentElement.style.removeProperty("--keyboard-offset");
      document.documentElement.classList.remove("keyboard-open", "keyboard-transitioning");
      if (keyboardAnimationTimer !== undefined) window.clearTimeout(keyboardAnimationTimer);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [navigate, location.pathname]);
}
