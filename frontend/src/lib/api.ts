import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/useAuthStore";
import { clearAllLocalState } from "./state";

//_retry doesn't exist in InternalAxiosRequestConfig, so we need to extend it
interface CustomAxiosRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

let refreshPromise: Promise<string> | null = null;

export const requestSessionRefresh = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const config: any = { withCredentials: true, headers: {} };
      if (!!(window as any).electronAPI?.auth) {
        const desktopToken = await (window as any).electronAPI.auth.getRefreshToken();
        if (desktopToken) {
          config.headers["X-Refresh-Token"] = desktopToken;
        }
      }

      return axios
        .post(
          `${import.meta.env.VITE_API_URL}/users/refresh`,
          {},
          config
        )
        .then((res) => {
          const { user, accessToken, refreshToken } = res.data;
          // If a new refresh token is issued and we're on desktop, save it securely
          if (!!(window as any).electronAPI?.auth && refreshToken) {
            (window as any).electronAPI.auth.setRefreshToken(refreshToken).catch(console.error);
          }
          useAuthStore.getState().setAuth(user, accessToken);
          return accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    })();
  }

  return refreshPromise;
};

const isAuthRoute = (url = "") =>
  url.includes("/users/login") ||
  url.includes("/users/desktop/login") ||
  url.includes("/users/register") ||
  url.includes("/users/verify-email") ||
  url.includes("/users/resend-verification") ||
  url.includes("/users/refresh") ||
  url.includes("/users/forgot-password") ||
  url.includes("/users/reset-password") ||
  url.includes("/users/google") ||
  url.includes("/users/exchange-code") ||
  url.includes("/users/showcase") ||
  url.includes("/public/");

const isPublicPage = () => {
  const path = window.location.pathname;
  return (
    path === "/login" ||
    path === "/signup" ||
    path === "/register" ||
    path === "/verify-email" ||
    path === "/forgot-password" ||
    path === "/oauth-success" ||
    path.startsWith("/reset-password") ||
    path.startsWith("/shared/")
  );
};

const createAuthError = (config: InternalAxiosRequestConfig) => {
  const error = new Error("Session expired. Please log in again.") as Error & {
    config: InternalAxiosRequestConfig;
    response: {
      status: number;
      data: { message: string };
    };
  };

  error.config = config;
  error.response = {
    status: 401,
    data: { message: "Session expired. Please log in again." },
  };

  return error;
};

// Request interceptor
api.interceptors.request.use(async (config) => {
  let token = useAuthStore.getState().accessToken;

  if (!token && !isAuthRoute(config.url)) {
    try {
      token = await requestSessionRefresh();
    } catch {
      clearAllLocalState();
      if (!isPublicPage()) window.location.href = "/login";
      throw createAuthError(config);
    }
  }

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  } else if (!isAuthRoute(config.url)) {
    clearAllLocalState();
    if (!isPublicPage()) window.location.href = "/login";
    throw createAuthError(config);
  }

  return config;
});

//response interceptors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequest;
    //If we get a 401 and haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/users/refresh")) {
      originalRequest._retry = true;

      try {
        const newToken = await requestSessionRefresh();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        clearAllLocalState();
        if (!isPublicPage()) window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }
    // Handle global network/connection errors
    if (!error.response) {
      // 1. Client can't reach the Server (Offline, DNS failure, local firewall, server down)
      const isOffline = !window.navigator.onLine;
      const message = isOffline 
        ? "You're offline. Please check your internet connection." 
        : "Unable to reach the server. Please check your connection.";
      
      import("sonner").then(({ toast }) => {
        toast.error("Network Error", {
          id: "network-error", 
          description: message,
          duration: Infinity, 
        });
      });
    } else {
      // 2. Server reached, but reported a connection failure (e.g. Server can't reach DB)
      const data = error.response.data;
      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        if (data.message.includes("ENOTFOUND") || data.message.includes("ECONNREFUSED")) {
          import("sonner").then(({ toast }) => {
            toast.error("Database Error", {
              description: "The backend is having trouble connecting to the database. Please check your connection.",
              duration: 10000,
            });
          });
        }
      }
    }

    return Promise.reject(error);
  },
);

// Clear the network error toast when we come back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    import("sonner").then(({ toast }) => {
      toast.dismiss("network-error");
      toast.success("Back online", { duration: 3000 });
    });
  });
}

export default api;
