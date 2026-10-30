import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";

type ConnectivityListener = (online: boolean) => void;

const listeners = new Set<ConnectivityListener>();

let online =
  typeof navigator === "undefined" ? true : navigator.onLine;
let initialized = false;
let initialization: Promise<void> | null = null;

const emit = () => {
  listeners.forEach((listener) => {
    try {
      listener(online);
    } catch (error) {
      console.warn("[Connectivity] Listener failed:", error);
    }
  });
};

const updateStatus = (nextOnline: boolean) => {
  if (online === nextOnline) return;
  online = nextOnline;
  emit();

  // Keep existing `window.addEventListener("online" | "offline")` consumers
  // working on Capacitor, where the WebView does not always emit these.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(nextOnline ? "online" : "offline"));
  }
};

export const isOnline = () => online;
export const isOffline = () => !online;

export const subscribeToConnectivity = (listener: ConnectivityListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Prime connectivity state once at startup.
 *
 * On Android/iOS the WebView's `navigator.onLine` can report `true` even when
 * there is no usable network. The native Network plugin gives us the real
 * status and keeps it updated. Web and Electron keep using navigator events.
 */
export const initializeConnectivity = (): Promise<void> => {
  if (initialized) return Promise.resolve();
  if (initialization) return initialization;

  initialization = (async () => {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => updateStatus(true));
      window.addEventListener("offline", () => updateStatus(false));
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        updateStatus(status.connected);

        await Network.addListener("networkStatusChange", (nextStatus) => {
          updateStatus(nextStatus.connected);
        });
      } catch (error) {
        console.warn(
          "[Connectivity] Native network status unavailable, falling back to navigator.onLine:",
          error,
        );
      }
    }

    initialized = true;
  })();

  return initialization;
};
