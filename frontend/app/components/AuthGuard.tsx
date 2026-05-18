"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, isGuestSession } from "../../lib/store";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (!isAuthenticated() && !isGuestSession()) {
        const isRoomPath = window.location.pathname.includes("/room/");
        router.replace(isRoomPath ? "/join" : "/login");
      } else if (isGuestSession()) {
        // Block Guest from restricted areas
        const pathname = window.location.pathname;
        const restrictedPaths = ["/dashboard", "/history", "/quizzes", "/host", "/profile"];
        if (restrictedPaths.some(p => pathname.startsWith(p))) {
           router.replace("/join");
        }
      }
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || (!isAuthenticated() && !isGuestSession())) {
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
