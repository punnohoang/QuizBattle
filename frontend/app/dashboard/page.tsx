"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import AuthGuard from "../components/AuthGuard";
import { quizApi, roomApi } from "../../lib/api";
import type { QuizResponse, RoomResponse } from "../../lib/types";

const CATEGORIES = [
  "All", "Science", "History", "Geography", "Sports", "Music", "Technology", "Math", "Other",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Science:    { bg: "#dbeafe", color: "#1d4ed8" },
  History:    { bg: "#fef3c7", color: "#92400e" },
  Geography:  { bg: "#d1fae5", color: "#065f46" },
  Sports:     { bg: "#fce7f3", color: "#9d174d" },
  Music:      { bg: "#ede9fe", color: "#5b21b6" },
  Technology: { bg: "#e0f2fe", color: "#075985" },
  Math:       { bg: "#fef9c3", color: "#713f12" },
  Other:      { bg: "#f3f4f6", color: "#374151" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("All");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hostingId, setHostingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCat !== "All" ? { category: filterCat, limit: 100 } : { limit: 100 };
      const { data } = await quizApi.list(params) as { data: QuizResponse[] };
      setQuizzes(data.filter((q) => !q.is_deleted));
    } catch {
      setError("Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, [filterCat]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this quiz?")) return;
    setDeletingId(id);
    try {
      await quizApi.delete(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } catch {
      alert("Failed to delete quiz.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleHost = async (quizId: number) => {
    setHostingId(quizId);
    try {
      const { data } = await roomApi.create(quizId) as { data: RoomResponse };
      router.push(`/room/${data.room_code}/wait`);
    } catch {
      alert("Failed to create room. Make sure the backend is running.");
    } finally {
      setHostingId(null);
    }
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        <Navbar />

        <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 32,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 4, color: "var(--text-primary)" }}>
                My Quizzes
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {quizzes.length} quiz{quizzes.length !== 1 ? "zes" : ""} created
              </p>
            </div>
            <Link href="/quiz/create" className="btn btn-primary">
              + Create Quiz
            </Link>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 24 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Category filters */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`filter-chip ${filterCat === cat ? "active" : ""}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
              <div className="spinner" />
            </div>
          ) : quizzes.length === 0 ? (
            <div
              className="card"
              style={{
                textAlign: "center",
                padding: "60px 24px",
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: "var(--border)",
                background: "var(--surface-alt)",
                boxShadow: "none",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>📝</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                No quizzes yet
              </h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                Create your first quiz to get started!
              </p>
              <Link href="/quiz/create" className="btn btn-primary">
                + Create Quiz
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {quizzes.map((quiz) => {
                const catStyle = CATEGORY_COLORS[quiz.category] ?? CATEGORY_COLORS["Other"];
                return (
                  <div key={quiz.id} className="quiz-card animate-fadeIn">
                    {/* Category badge */}
                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: catStyle.bg,
                          color: catStyle.color,
                        }}
                      >
                        {quiz.category}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontWeight: 700,
                        fontSize: "1rem",
                        lineHeight: 1.45,
                        color: "var(--text-primary)",
                        marginBottom: 0,
                      }}
                    >
                      {quiz.title}
                    </h3>

                    {quiz.description && (
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.85rem",
                          lineHeight: 1.6,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          marginBottom: 0,
                        }}
                      >
                        {quiz.description}
                      </p>
                    )}

                    {/* Meta */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>❓ {quiz.question_count} questions</span>
                      <span>📅 {formatDate(quiz.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="divider" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleHost(quiz.id)}
                        className="btn btn-primary btn-sm"
                        disabled={hostingId === quiz.id}
                        style={{ flex: 1 }}
                      >
                        {hostingId === quiz.id ? (
                          <><div className="spinner spinner-sm" /> Starting...</>
                        ) : (
                          "▶ Host"
                        )}
                      </button>
                      <Link
                        href={`/quiz/${quiz.id}/edit`}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, textAlign: "center" }}
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="btn btn-sm"
                        disabled={deletingId === quiz.id}
                        style={{
                          background: "var(--danger-light)",
                          color: "var(--danger)",
                          border: "1px solid #fca5a5",
                        }}
                      >
                        {deletingId === quiz.id ? (
                          <div className="spinner spinner-sm" />
                        ) : "🗑"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
