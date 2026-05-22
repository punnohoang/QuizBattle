"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi, userApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import type { User } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.login(form);
      const { data: user } = await userApi.me() as { data: User };
      login(user);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--background)",
        backgroundImage:
          "radial-gradient(circle at 15% 20%, rgba(59,130,246,0.07) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(30,58,138,0.06) 0%, transparent 50%)",
      }}
    >
      {/* Navbar */}
      <nav className="navbar">
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--gradient-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem", boxShadow: "var(--shadow-primary)",
                }}
              >⚡</div>
              <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--primary)" }}>
                QuizBattle
              </span>
            </div>
          </Link>
          <Link href="/register" className="btn btn-secondary btn-sm">
            Create Account
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div
        style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }} className="animate-fadeIn">
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: 18,
                background: "var(--gradient-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.75rem", margin: "0 auto 16px",
                boxShadow: "var(--shadow-primary)",
              }}
            >⚡</div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>
              Welcome back
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Sign in to your QuizBattle account
            </p>
          </div>

          {/* Card */}
          <div className="card" style={{ padding: "2rem" }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 20 }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
                style={{ marginTop: 8, padding: "12px" }}
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div
              style={{
                marginTop: 24, paddingTop: 20,
                borderTop: "1px solid var(--border)",
                textAlign: "center",
              }}
            >
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  style={{ color: "var(--accent)", fontWeight: 600 }}
                >
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
