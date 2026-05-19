"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { useAuthStore, isGuestSession } from "../../lib/store";
import { authApi } from "../../lib/api";

export default function Navbar() {
  return (
    <Suspense fallback={
      <nav className="navbar" style={{ position: "sticky", top: 0, zIndex: 100 }}>
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--gradient-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem", boxShadow: "var(--shadow-primary)", flexShrink: 0,
              }}
            >⚡</div>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)", letterSpacing: "-0.01em" }}>
              QuizBattle
            </span>
          </div>
        </div>
      </nav>
    }>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarContent() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardView = searchParams.get("view") ?? "my";

  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const logoHref = mounted && isAuthenticated() ? "/dashboard" : "/";

  const handleLogout = async () => {
    setMenuOpen(false);
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    router.push("/");
  };

  const isGuest = mounted ? isGuestSession() : false;
  const navLinks = mounted
    ? [
        { href: "/dashboard", label: "My Quizzes", icon: "📚", hideForGuest: true },
        { href: "/dashboard?view=public", label: "Public Quizzes", icon: "🌐", hideForGuest: true },
        { href: "/history", label: "History", icon: "🕘", hideForGuest: true },
        { href: "/join", label: "Join", icon: "🎯" },
      ].filter((link) => !isGuest || !link.hideForGuest)
    : [{ href: "/join", label: "Join", icon: "🎯" }];

  const isLinkActive = (href: string) => {
    if (!href.startsWith("/dashboard")) return pathname === href;
    const isPublicLink = href.includes("view=public");
    return pathname === "/dashboard" && (isPublicLink ? dashboardView === "public" : dashboardView !== "public");
  };

  const auth = mounted ? isAuthenticated() : false;

  return (
    <>
      <nav className="navbar" style={{ position: "sticky", top: 0, zIndex: 100 }}>
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}
        >
          {/* Logo */}
          <Link href={logoHref} style={{ textDecoration: "none", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "var(--gradient-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem", boxShadow: "var(--shadow-primary)", flexShrink: 0,
                }}
              >⚡</div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--primary)", letterSpacing: "-0.01em" }}>
                QuizBattle
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="navbar-desktop-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {!mounted ? (
              <>
                <Link href="/join" className="btn btn-ghost btn-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>🎯 Join</Link>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            ) : auth ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: isLinkActive(link.href) ? "var(--primary)" : "var(--text-secondary)",
                      background: isLinkActive(link.href) ? "var(--primary-muted)" : undefined,
                      fontWeight: isLinkActive(link.href) ? 600 : 500,
                    }}
                  >
                    {link.icon} {link.label}
                  </Link>
                ))}
                <Link
                  href="/profile"
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "4px 10px 4px 4px", borderRadius: 999,
                    background: "var(--surface-alt)", border: "1.5px solid var(--border)",
                    marginLeft: 4, textDecoration: "none", transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 26, height: 26,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--gradient-primary)",
                      fontSize: "0.72rem", fontWeight: 800, color: "white",
                    }}
                  >
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      user?.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {user?.username}
                  </span>
                </Link>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: "var(--text-secondary)" }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/join" className="btn btn-ghost btn-sm" style={{ color: "var(--primary)", fontWeight: 700 }}>🎯 Join</Link>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile: avatar + hamburger */}
          <div className="navbar-mobile-right" style={{ display: "none", alignItems: "center", gap: 8 }}>
            {mounted && auth && (
              <Link href="/profile" style={{ textDecoration: "none" }}>
                <div
                  style={{
                    width: 32, height: 32,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "2px solid var(--accent-light)",
                    boxShadow: "0 0 0 1px rgba(59,130,246,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--gradient-primary)",
                    fontSize: "0.78rem", fontWeight: 800, color: "white",
                  }}
                >
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: menuOpen ? "var(--primary-muted)" : "transparent",
                border: "1.5px solid var(--border)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 5, cursor: "pointer", padding: 0, transition: "background 0.2s",
              }}
              aria-label="Menu"
            >
              <span style={{
                display: "block", width: 18, height: 2,
                background: menuOpen ? "var(--primary)" : "var(--text-secondary)",
                borderRadius: 2,
                transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
                transition: "transform 0.2s, background 0.2s",
              }} />
              <span style={{
                display: "block", width: 18, height: 2,
                background: menuOpen ? "transparent" : "var(--text-secondary)",
                borderRadius: 2, transition: "background 0.2s",
              }} />
              <span style={{
                display: "block", width: 18, height: 2,
                background: menuOpen ? "var(--primary)" : "var(--text-secondary)",
                borderRadius: 2,
                transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                transition: "transform 0.2s, background 0.2s",
              }} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute", top: "100%", left: 0, right: 0,
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              zIndex: 200,
              animation: "navbar-dropdown 0.2s cubic-bezier(0.22,1,0.36,1)",
              padding: "8px 16px 16px",
              display: "flex", flexDirection: "column", gap: 4,
            }}
          >
            {!mounted || !auth ? (
              <>
                <Link href="/join" className="btn btn-primary btn-block" style={{ justifyContent: "center", marginBottom: 4 }}>
                  🎯 Join Game
                </Link>
                <Link href="/login" className="btn btn-secondary btn-block" style={{ justifyContent: "center" }}>
                  Sign In
                </Link>
                <Link href="/register" className="btn btn-ghost btn-block" style={{ justifyContent: "center" }}>
                  Create Account
                </Link>
              </>
            ) : (
              <>
                <div style={{
                  padding: "12px 12px 10px",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div
                    style={{
                      width: 36, height: 36,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--gradient-primary)",
                      fontSize: "0.9rem", fontWeight: 800, color: "white",
                      border: "2px solid var(--accent-light)",
                    }}
                  >
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      user?.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>{user?.username}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{user?.email}</div>
                  </div>
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="btn btn-ghost btn-block"
                    style={{
                      justifyContent: "flex-start",
                      color: isLinkActive(link.href) ? "var(--primary)" : "var(--text-secondary)",
                      background: isLinkActive(link.href) ? "var(--primary-muted)" : undefined,
                      fontWeight: isLinkActive(link.href) ? 700 : 500,
                      borderRadius: 10,
                    }}
                  >
                    <span>{link.icon}</span> {link.label}
                  </Link>
                ))}
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <button
                  onClick={handleLogout}
                  className="btn btn-ghost btn-block"
                  style={{ justifyContent: "flex-start", color: "var(--danger)", borderRadius: 10 }}
                >
                  🚪 Logout
                </button>
              </>
            )}
          </div>
        )}
      </nav>

      <style>{`
        @keyframes navbar-dropdown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .navbar-desktop-links { display: none !important; }
          .navbar-mobile-right  { display: flex !important; }
        }
      `}</style>
    </>
  );
}
