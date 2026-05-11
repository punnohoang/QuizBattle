"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "../../lib/store";
import { authApi } from "../../lib/api";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const logoHref = isAuthenticated() ? "/dashboard" : "/";

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      logout();
      router.push("/");
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "My Quizzes", icon: "📚" },
  ];

  return (
    <nav className="navbar">
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <Link href={logoHref} style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                boxShadow: "var(--shadow-primary)",
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: "1.15rem",
                color: "var(--primary)",
                letterSpacing: "-0.01em",
              }}
            >
              QuizBattle
            </span>
          </div>
        </Link>

        {/* Nav links + auth */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAuthenticated() ? (
            <>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="btn btn-ghost btn-sm"
                  style={{
                    color: pathname === link.href ? "var(--primary)" : "var(--text-secondary)",
                    background: pathname === link.href ? "var(--primary-muted)" : undefined,
                    fontWeight: pathname === link.href ? 600 : 500,
                  }}
                >
                  {link.icon} {link.label}
                </Link>
              ))}

              {/* User pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px 5px 5px",
                  borderRadius: 999,
                  background: "var(--surface-alt)",
                  border: "1.5px solid var(--border)",
                  marginLeft: 4,
                }}
              >
                <div
                  className="avatar avatar-sm"
                  style={{ width: 28, height: 28, fontSize: "0.75rem" }}
                >
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {user?.username}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
