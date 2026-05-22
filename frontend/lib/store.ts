import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  isLoading: boolean;

  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  isAuthenticated: () => boolean;
}

export const cleanupLegacyAuthStorage = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  } catch {
    // ignore storage errors
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      login: (user) => {
        set({ user });
      },

      logout: () => {
        cleanupLegacyAuthStorage();
        set({ user: null });
      },

      setUser: (user) => set({ user }),

      isAuthenticated: () => !!get().user,
    }),
    {
      name: "quizbattle-auth",
      version: 2,
      migrate: (persistedState: any) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        return { user: persistedState.user ?? null };
      },
      onRehydrateStorage: () => () => {
        cleanupLegacyAuthStorage();
      },
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

export const isGuestSession = () => {
  if (typeof window === "undefined") return false;
  return !!sessionStorage.getItem("guest_token");
};
