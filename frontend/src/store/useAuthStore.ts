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

const getInitialUser = (): User | null => {
  try {
    const raw = localStorage.getItem("notesify_user_profile");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: getInitialUser(),
  accessToken: null,
  authChecked: false,
  setAuth: (user, token) => {
    if (user?.name) {
      localStorage.setItem("lastUserName", user.name);
    }
    if (user) {
      localStorage.setItem("notesify_user_profile", JSON.stringify(user));
    }
    set({ user, accessToken: token, authChecked: true });
  },
  markAuthChecked: () => set({ authChecked: true }),

  clearAuth: () => {
    localStorage.removeItem("lastUserName");
    localStorage.removeItem("notesify_user_profile");
    set({ user: null, accessToken: null, authChecked: true });
  },
  updateUser: (updates) =>
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...updates } : null;
      if (updatedUser) {
        if (updatedUser.name) localStorage.setItem("lastUserName", updatedUser.name);
        localStorage.setItem("notesify_user_profile", JSON.stringify(updatedUser));
      }
      return { user: updatedUser };
    }),
}));
