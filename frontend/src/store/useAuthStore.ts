import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isVerified: boolean;
  provider?: "local" | "google";
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  authChecked: boolean;
  setAuth: (user: User, token: string) => void;
  markAuthChecked: () => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  authChecked: false,
  setAuth: (user, token) => {
    if (user?.name) {
      localStorage.setItem("lastUserName", user.name);
    }
    set({ user, accessToken: token, authChecked: true });
  },
  markAuthChecked: () => set({ authChecked: true }),

  clearAuth: () => {
    localStorage.removeItem("lastUserName");
    set({ user: null, accessToken: null, authChecked: true });
  },
  updateUser: (updates) =>
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...updates } : null;
      if (updatedUser?.name) {
        localStorage.setItem("lastUserName", updatedUser.name);
      }
      return { user: updatedUser };
    }),
}));
