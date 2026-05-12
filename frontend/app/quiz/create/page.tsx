"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import AuthGuard from "../../components/AuthGuard";
import { quizApi } from "../../../lib/api";
import type { QuizResponse } from "../../../lib/types";

const CATEGORIES = [
  "Science", "History", "Geography", "Sports",
  "Music", "Technology", "Math", "Other",
];

export default function CreateQuizPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", category: "Science", is_public: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        title: form.title,
        category: form.category,
        is_public: form.is_public,
        ...(form.description ? { description: form.description } : {}),
      };
      const { data } = await quizApi.create(payload) as { data: QuizResponse };
      router.push(`/quiz/${data.id}/edit`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail ?? "Failed to create quiz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        <Navbar />
        <div className="container" style={{ paddingTop: 48, paddingBottom: 80, maxWidth: 660 }}>

          {/* Breadcrumb */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 28, fontSize: "0.875rem", color: "var(--text-muted)",
            }}
          >
            <Link href="/dashboard" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              My Quizzes
            </Link>
            <span style={{ color: "var(--border)" }}>›</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Create Quiz</span>
          </div>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>
            Create a new quiz
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            Set up the basics – you&apos;ll add questions in the next step.
          </p>

          <div className="card animate-fadeIn" style={{ padding: "2rem" }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: 24 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="form-group">
                <label htmlFor="title">Quiz Title *</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g. World Geography Challenge"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">
                  Description{" "}
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="description"
                  placeholder="What is this quiz about?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category *</label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-alt)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Make this quiz public</span>
                  <span style={{ display: "block", color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 2 }}>
                    Public quizzes can be shown as visible to everyone.
                  </span>
                </span>
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Link
                  href="/dashboard"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ flex: 2, justifyContent: "center" }}
                >
                  {loading ? (
                    <><div className="spinner spinner-sm" /> Creating...</>
                  ) : (
                    "Create & Add Questions →"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
