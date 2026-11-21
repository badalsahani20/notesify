import { useEffect, useRef } from "react";
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

const KEYBOARD_OFFSET_EVENT = "notesify:keyboard-offset";
const KEYBOARD_ANIMATION_MS = 280;

export function useCapacitorApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hardware back needs the current route, but re-registering the native
  // listener on every navigation also tore down the keyboard listeners.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // 1. Keyboard inset — one app-level writer for every platform.
  //
  // Native reports the IME height through the Keyboard plugin; browsers only
  // resize the visual viewport. Everything else reads --keyboard-offset (or the
  // custom event) instead of measuring again, so there is a single source of
  // truth and one animation timing. Mounted once: a route change while the IME
  // is open must never clear the offset.
  useEffect(() => {
    const root = document.documentElement;
    let transitionTimer: number | undefined;
    let removeListeners: (() => void) | undefined;

    const applyOffset = (height: number) => {
      const offset = Math.max(0, Math.round(height));
      root.style.setProperty("--keyboard-offset", `${offset}px`);
      root.classList.toggle("keyboard-open", offset > 0);
      root.classList.add("keyboard-transitioning");
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => {
        root.classList.remove("keyboard-transitioning");
      }, KEYBOARD_ANIMATION_MS);
      window.dispatchEvent(new CustomEvent<number>(KEYBOARD_OFFSET_EVENT, { detail: offset }));
    };

    if (Capacitor.isNativePlatform()) {
      const showListener = Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) =>
        applyOffset(keyboardHeight)
      );
      const hideListener = Keyboard.addListener("keyboardWillHide", () => {
        applyOffset(0);
      });
      removeListeners = () => {
        void showListener.then((handle) => handle.remove());
        void hideListener.then((handle) => handle.remove());
      };
    } else if (window.visualViewport) {
      const viewport = window.visualViewport;
      const sync = () => {
        // Pinch-zoom also shrinks the visual viewport; only the IME counts here.
        if (viewport.scale !== 1) return;
        applyOffset(window.innerHeight - viewport.height - viewport.offsetTop);
      };
      sync();
      viewport.addEventListener("resize", sync);
      viewport.addEventListener("scroll", sync);
      removeListeners = () => {
        viewport.removeEventListener("resize", sync);
        viewport.removeEventListener("scroll", sync);
      };
    }

    return () => {
      removeListeners?.();
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
      root.style.removeProperty("--keyboard-offset");
      root.classList.remove("keyboard-open", "keyboard-transitioning");
    };
  }, []);

  // 2. Native shell setup: root class, long-press haptic, status-bar theme.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add("is-capacitor");

    // Android dispatches this after a true long press has opened its context menu.
    // Keeping this global makes the feedback consistent for every long-press menu.
    const handleContextMenu = () => triggerSelectionHaptic();
    document.addEventListener("contextmenu", handleContextMenu);

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

    return () => {
      themeObserver.disconnect();
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // 3. Native navigation: deep links and the hardware back button.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

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
      const pathname = pathnameRef.current;
      const isRoot = pathname === "/" || pathname === "/login";
      if (!isRoot && canGoBack) {
        navigate(-1);
      } else {
        void CapApp.exitApp();
      }
    });

    return () => {
      void urlListenerPromise.then((handle) => handle.remove());
      void backListenerPromise.then((handle) => handle.remove());
    };
  }, [navigate]);
}
