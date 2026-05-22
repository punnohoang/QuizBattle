"use client";

/**
 * AuthInitializer
 *
 * Runs once on app mount. If Zustand has no user but the browser still holds
 * a valid access_token HttpOnly cookie, silently re-hydrates the user profile
 * by calling /users/me.
 *
 * This handles the page-refresh scenario: localStorage (Zustand persist) was
 * cleared, but the cookie is still valid.  Without this, the user would appear
 * logged-out until they manually revisit a protected route.
 *
 * Renders nothing — purely a side-effect component.
 */

import { useEffect } from "react";
import { cleanupLegacyAuthStorage, useAuthStore } from "@/lib/store";
import { userApi } from "@/lib/api";

export default function AuthInitializer() {
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    cleanupLegacyAuthStorage();
    // Only attempt hydration if Zustand currently has no user.
    if (user) return;

    userApi
      .me()
      .then(({ data }) => {
        setUser(data);
      })
      .catch(() => {
        // 401 = no valid cookie, or cookie expired. Nothing to do here;
        // individual protected routes / AuthGuard will redirect as needed.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  return null;
}
