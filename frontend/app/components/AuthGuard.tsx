"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, isGuestSession } from "../../lib/store";
import { userApi } from "../../lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // If Zustand has no user but we might have a valid access_token cookie,
    // attempt to re-hydrate by fetching /users/me. This handles the case
    // where localStorage was cleared but the HttpOnly cookie is still valid.
    if (!isAuthenticated() && !isGuestSession()) {
      setHydrating(true);
      userApi
        .me()
        .then(({ data }) => {
          setUser(data);
          setHydrating(false);
        })
        .catch(() => {
          setHydrating(false);
          const isRoomPath = window.location.pathname.includes("/room/");
          router.replace(isRoomPath ? "/join" : "/login");
        });
      return;
    }

    // Block Guest from restricted areas
    if (isGuestSession()) {
      const pathname = window.location.pathname;
      const restrictedPaths = ["/dashboard", "/history", "/quizzes", "/host", "/profile"];
      if (restrictedPaths.some((p) => pathname.startsWith(p))) {
        router.replace("/join");
      }
    }
  }, [mounted, isAuthenticated, user, router, setUser]);

  if (!mounted || hydrating || (!isAuthenticated() && !isGuestSession())) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return <>{children}</>;
}
