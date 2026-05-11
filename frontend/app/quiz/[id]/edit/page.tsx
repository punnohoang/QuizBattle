"use client";

import { useEffect, useState, useCallback, use } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import AuthGuard from "../../../components/AuthGuard";
import { quizApi, roomApi } from "../../../../lib/api";
import type { QuizDetailResponse, QuestionResponse, QuestionCreate, RoomResponse } from "../../../../lib/types";

const OPT_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const OPT_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", dot: "#2563eb" },
  { bg: "#d1fae5", border: "#6ee7b7", dot: "#059669" },
  { bg: "#fef3c7", border: "#fcd34d", dot: "#d97706" },
  { bg: "#fee2e2", border: "#fca5a5", dot: "#dc2626" },
  { bg: "#f3e8ff", border: "#d8b4fe", dot: "#a855f7" },
  { bg: "#fce7f3", border: "#fbcfe8", dot: "#ec4899" },
  { bg: "#f0fdfa", border: "#99f6e4", dot: "#14b8a6" },
  { bg: "#fefce8", border: "#facc15", dot: "#ca8a04" },
  { bg: "#ecfdf5", border: "#86efac", dot: "#22c55e" },
  { bg: "#eff6ff", border: "#7dd3fc", dot: "#0284c7" },
];

const getOptionColor = (index: number) => {
  const colors = OPT_COLORS;
  return colors[index % colors.length];
};

export default function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const quizId = parseInt(id, 10);

  const [quiz, setQuiz] = useState<QuizDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hostingId, setHostingId] = useState<number | null>(null);
  const [showEditQuizModal, setShowEditQuizModal] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: "",
    description: "",
    category: "",
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState<QuestionCreate>({
    content: "",
    type: "multiple_choice",
    score_type: "normal",
    time_limit: 20,
    order_index: 0,
    options: [
      { content: "", is_correct: true,  order_index: 0 },
    ],
  });
  const [savingQuestion, setSavingQuestion] = useState(false);

  const createQuestionDraft = (questionType: "multiple_choice" | "true_false") => {
    if (questionType === "true_false") {
      return {
        content: "",
        type: "true_false",
        score_type: "normal",
        time_limit: 20,
        order_index: 0,
        options: [
          { content: "True", is_correct: true,  order_index: 0 },
          { content: "False", is_correct: false, order_index: 1 },
        ],
      };
    }

    return {
      content: "",
      type: "multiple_choice",
      score_type: "normal",
      time_limit: 20,
      order_index: 0,
      options: [
        { content: "", is_correct: true,  order_index: 0 },
      ],
    };
  };

  const openNewQuestionModal = (questionType: "multiple_choice" | "true_false" = "multiple_choice") => {
    setEditingQuestionId(null);
    setNewQuestion(createQuestionDraft(questionType));
    setShowAddModal(true);
  };

  const openEditQuestionModal = (question: QuestionResponse) => {
    const questionType = question.type === "TF" || question.type === "true_false"
      ? "true_false"
      : "multiple_choice";
    setEditingQuestionId(question.id);
    setNewQuestion({
      content: question.content,
      type: questionType,
      score_type: question.score_type as "normal" | "double",
      time_limit: question.time_limit,
      order_index: question.order_index,
      options: question.options.map((option, index) => ({
        content: option.content,
        is_correct: option.is_correct,
        order_index: index,
      })),
    });
    setShowAddModal(true);
  };

  const closeQuestionModal = () => {
    setShowAddModal(false);
    setEditingQuestionId(null);
    setNewQuestion(createQuestionDraft("multiple_choice"));
  };

  const setQuestionType = (questionType: "multiple_choice" | "true_false") => {
    setNewQuestion((current) => {
      const nextOptions =
        questionType === "true_false"
          ? [
              { content: "True", is_correct: true, order_index: 0 },
              { content: "False", is_correct: false, order_index: 1 },
            ]
          : [
              { content: "", is_correct: true, order_index: 0 },
            ];

      return {
        ...current,
        type: questionType,
        options: nextOptions,
      };
    });
  };

  const loadQuiz = useCallback(async () => {
    try {
      const { data } = await quizApi.get(quizId) as { data: QuizDetailResponse };
      setQuiz(data);
    } catch {
      setError("Failed to load quiz.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const openEditQuizModal = () => {
    if (!quiz) return;
    setQuizForm({
      title: quiz.title,
      description: quiz.description ?? "",
      category: quiz.category,
    });
    setShowEditQuizModal(true);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    setSavingQuiz(true);
    try {
      await quizApi.update(quizId, {
        title: quizForm.title.trim(),
        description: quizForm.description.trim() || undefined,
        category: quizForm.category.trim(),
      });
      setShowEditQuizModal(false);
      loadQuiz();
    } catch {
      alert("Failed to update quiz. Make sure all fields are filled.");
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleHost = async () => {
    if (quiz?.questions.length === 0) {
      alert("Cannot host a quiz with no questions.");
      return;
    }
    setHostingId(quizId);
    try {
      const { data } = await roomApi.create(quizId) as { data: RoomResponse };
      router.push(`/room/${data.room_code}/wait`);
    } catch {
      alert("Failed to create room.");
    } finally {
      setHostingId(null);
    }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Delete this question?")) return;
    try {
      await quizApi.deleteQuestion(quizId, qId);
      loadQuiz();
    } catch {
      alert("Failed to delete question.");
    }
  };

  const handleSaveQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setSavingQuestion(true);
    try {
      const payload = {
        ...newQuestion,
        order_index: editingQuestionId !== null ? newQuestion.order_index : (quiz?.questions.length || 0),
      };
      if (editingQuestionId !== null) {
        await quizApi.updateQuestion(quizId, editingQuestionId, payload);
      } else {
        await quizApi.createQuestion(quizId, payload);
      }
      closeQuestionModal();
      loadQuiz();
    } catch {
      alert("Failed to save question. Make sure all fields are filled.");
    } finally {
      setSavingQuestion(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateOption = (idx: number, field: string, val: any) => {
    const newOpts = [...newQuestion.options];
    if (field === "is_correct" && val === true) {
      // Reset all options to false first, then set the selected one to true
      newOpts.forEach(o => (o.is_correct = false));
    }
    newOpts[idx] = { ...newOpts[idx], [field]: val };
    setNewQuestion({ ...newQuestion, options: newOpts });
  };

  const addOption = () => {
    if (newQuestion.type !== "multiple_choice") return;
    const newOpts = [...newQuestion.options];
    newOpts.push({
      content: "",
      is_correct: false,
      order_index: newOpts.length,
    });
    setNewQuestion({ ...newQuestion, options: newOpts });
  };

  const removeOption = (idx: number) => {
    if (newQuestion.type !== "multiple_choice" || newQuestion.options.length <= 1) return;
    const newOpts = newQuestion.options
      .filter((_, i) => i !== idx)
      .map((option, index) => ({ ...option, order_index: index }));
    setNewQuestion({ ...newQuestion, options: newOpts });
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        <Navbar />

        <div className="container" style={{ paddingTop: 40, paddingBottom: 100 }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: "0.875rem" }}>
            <Link href="/dashboard" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              My Quizzes
            </Link>
            <span style={{ color: "var(--border)" }}>›</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {quiz?.title || "Edit Quiz"}
            </span>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
              <div className="spinner" />
            </div>
          ) : error || !quiz ? (
            <div className="alert alert-error">
              <span>⚠️</span> {error || "Quiz not found"}
            </div>
          ) : (
            <>
              {/* Quiz Header Card */}
              <div
                className="card"
                style={{
                  marginBottom: 28,
                  padding: "1.5rem 2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  borderLeft: "4px solid var(--primary)",
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openEditQuizModal}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEditQuizModal();
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    padding: "8px 10px",
                    margin: "-8px -10px",
                    borderRadius: 12,
                    transition: "transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "var(--surface-alt)";
                    event.currentTarget.style.transform = "translateY(-1px)";
                    event.currentTarget.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.08)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                    event.currentTarget.style.transform = "translateY(0)";
                    event.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <span className="badge">{quiz.category}</span>
                    {quiz.questions.length === 0 && (
                      <span className="badge badge-warning" style={{ marginLeft: 8 }}>No questions</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 4, color: "var(--text-primary)" }}>
                      {quiz.title}
                    </h1>
                  </div>
                  {quiz.description && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 0 }}>
                      {quiz.description}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => openNewQuestionModal("multiple_choice")}
                    className="btn btn-secondary"
                  >
                    + Add Question
                  </button>
                  <button
                    onClick={handleHost}
                    className="btn btn-primary"
                    disabled={hostingId === quizId || quiz.questions.length === 0}
                  >
                    {hostingId === quizId ? (
                      <><div className="spinner spinner-sm" /> Starting...</>
                    ) : (
                      "▶ Play Now"
                    )}
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
                  Questions ({quiz.questions.length})
                </h2>

                {quiz.questions.length === 0 ? (
                  <div
                    className="card"
                    style={{
                      textAlign: "center",
                      padding: "56px 24px",
                      borderStyle: "dashed",
                      borderWidth: 2,
                      borderColor: "var(--border)",
                      background: "var(--surface-alt)",
                      boxShadow: "none",
                    }}
                  >
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>❓</div>
                    <h3 style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                      No questions yet
                    </h3>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
                      Add your first question to get started
                    </p>
                    <button
                      onClick={() => openNewQuestionModal("multiple_choice")}
                      className="btn btn-primary btn-sm"
                    >
                      + Add First Question
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {quiz.questions.map((q: QuestionResponse, i: number) => (
                      <div
                        key={q.id}
                        className="card animate-fadeIn"
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditQuestionModal(q)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openEditQuestionModal(q);
                          }
                        }}
                        onMouseEnter={() => setHoveredQuestionId(q.id)}
                        onMouseLeave={() => setHoveredQuestionId((current) => (current === q.id ? null : current))}
                        style={{
                          padding: "1.25rem 1.5rem",
                          cursor: "pointer",
                          transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                          transform: hoveredQuestionId === q.id ? "translateY(-2px)" : "translateY(0)",
                          boxShadow: hoveredQuestionId === q.id ? "0 18px 40px rgba(15, 23, 42, 0.12)" : undefined,
                          borderColor: hoveredQuestionId === q.id ? "var(--primary)" : undefined,
                        }}
                      >
                        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                          {/* Number circle */}
                          <div
                            style={{
                              width: 36, height: 36, borderRadius: "50%",
                              background: "var(--gradient-primary)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontWeight: 800, color: "white", fontSize: "0.9rem",
                              flexShrink: 0,
                            }}
                          >
                            {i + 1}
                          </div>

                          <div style={{ flex: 1 }}>
                            {/* Meta badges */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  padding: "2px 10px", borderRadius: 999,
                                  fontSize: "0.75rem", fontWeight: 600,
                                  background: "var(--primary-muted)",
                                  color: "var(--primary)",
                                  border: "1px solid var(--accent-light)",
                                }}
                              >
                                ⏱ {q.time_limit}s
                              </span>
                              {q.score_type === "double" && (
                                <span
                                  style={{
                                    padding: "2px 10px", borderRadius: 999,
                                    fontSize: "0.75rem", fontWeight: 600,
                                    background: "#fef3c7", color: "#92400e",
                                    border: "1px solid #fcd34d",
                                  }}
                                >
                                  ⭐ Double Points
                                </span>
                              )}
                            </div>

                            {/* Question text */}
                            <h3
                              style={{
                                fontSize: "1rem", fontWeight: 600,
                                marginBottom: 14, lineHeight: 1.45,
                                color: "var(--text-primary)",
                                paddingRight: 40,
                              }}
                            >
                              {q.content}
                            </h3>

                            {/* Options grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              {q.options.map((o, oi) => (
                                <div
                                  key={o.id}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: "0.875rem",
                                    background: o.is_correct
                                      ? "var(--success-light)"
                                      : "var(--surface-alt)",
                                    border: `1.5px solid ${o.is_correct ? "#6ee7b7" : "var(--border)"}`,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 22, height: 22, borderRadius: 6,
                                      background: getOptionColor(oi).bg,
                                      border: `1.5px solid ${getOptionColor(oi).border}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontWeight: 700, fontSize: "0.7rem",
                                      color: getOptionColor(oi).dot,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {OPT_LABELS[oi]}
                                  </span>
                                  <span
                                    style={{
                                      color: o.is_correct ? "var(--success)" : "var(--text-secondary)",
                                      fontWeight: o.is_correct ? 600 : 400,
                                    }}
                                  >
                                    {o.content}
                                  </span>
                                  {o.is_correct && (
                                    <span style={{ marginLeft: "auto", color: "var(--success)", fontSize: "0.85rem" }}>✓</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: "var(--danger-light)",
                              color: "var(--danger)",
                              border: "1px solid #fca5a5",
                              flexShrink: 0,
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit Quiz Modal */}
        {showEditQuizModal && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(17,24,39,0.45)",
                backdropFilter: "blur(4px)",
              }}
              onClick={() => setShowEditQuizModal(false)}
            />

            <div
              className="card animate-slideInUp"
              style={{
                position: "relative", width: "100%", maxWidth: 560,
                padding: "2rem", zIndex: 1,
              }}
            >
              <div
                style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 24,
                }}
              >
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 0, color: "var(--text-primary)" }}>
                  Edit Quiz
                </h2>
                <button
                  onClick={() => setShowEditQuizModal(false)}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "6px 10px", fontSize: "1.1rem" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveQuiz} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="form-group">
                  <label htmlFor="quizTitle">Quiz Title *</label>
                  <input
                    id="quizTitle"
                    type="text"
                    required
                    value={quizForm.title}
                    onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quizDescription">Description</label>
                  <textarea
                    id="quizDescription"
                    rows={3}
                    value={quizForm.description}
                    onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quizCategory">Category *</label>
                  <input
                    id="quizCategory"
                    type="text"
                    required
                    value={quizForm.category}
                    onChange={(e) => setQuizForm({ ...quizForm, category: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowEditQuizModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingQuiz}
                    style={{ flex: 2 }}
                  >
                    {savingQuiz ? (
                      <><div className="spinner spinner-sm" /> Saving...</>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Question Modal */}
        {showAddModal && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            {/* Backdrop */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: "rgba(17,24,39,0.45)",
                backdropFilter: "blur(4px)",
              }}
              onClick={closeQuestionModal}
            />

            {/* Modal */}
            <div
              className="card animate-slideInUp"
              style={{
                position: "relative", width: "100%", maxWidth: 580,
                maxHeight: "90vh", overflowY: "auto",
                padding: "2rem", zIndex: 1,
              }}
            >
              {/* Modal header */}
              <div
                style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 24,
                }}
              >
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 0, color: "var(--text-primary)" }}>
                  {editingQuestionId !== null ? "Edit Question" : "Add Question"}
                </h2>
                <button
                  onClick={closeQuestionModal}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "6px 10px", fontSize: "1.1rem" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Question Type Selector */}
                <div>
                  <label
                    style={{
                      display: "block", fontWeight: 600,
                      fontSize: "0.875rem", marginBottom: 12,
                      color: "var(--text-primary)",
                    }}
                  >
                    Question Type *
                  </label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setQuestionType("multiple_choice")}
                      style={{
                        flex: 1, padding: "12px 16px", borderRadius: 8,
                        border: `2px solid ${newQuestion.type === "multiple_choice" ? "var(--primary)" : "var(--border)"}`,
                        background: newQuestion.type === "multiple_choice" ? "var(--primary-muted)" : "var(--surface-alt)",
                        color: newQuestion.type === "multiple_choice" ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      📋 Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionType("true_false")}
                      style={{
                        flex: 1, padding: "12px 16px", borderRadius: 8,
                        border: `2px solid ${newQuestion.type === "true_false" ? "var(--primary)" : "var(--border)"}`,
                        background: newQuestion.type === "true_false" ? "var(--primary-muted)" : "var(--surface-alt)",
                        color: newQuestion.type === "true_false" ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      ✓❌ True/False
                    </button>
                  </div>
                </div>

                {/* Question text */}
                <div className="form-group">
                  <label htmlFor="qContent">Question Text *</label>
                  <textarea
                    id="qContent"
                    rows={2}
                    required
                    placeholder="Enter your question here..."
                    value={newQuestion.content}
                    onChange={e => setNewQuestion({ ...newQuestion, content: e.target.value })}
                  />
                </div>

                {/* Time limit + Points */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="timeLimit">Time Limit</label>
                    <select
                      id="timeLimit"
                      value={newQuestion.time_limit || 20}
                      onChange={e => setNewQuestion({ ...newQuestion, time_limit: parseInt(e.target.value) })}
                    >
                      {[10, 20, 30, 60, 90].map(v => (
                        <option key={v} value={v}>{v} seconds</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="scoreType">Points</label>
                    <select
                      id="scoreType"
                      value={newQuestion.score_type}
                      onChange={e => setNewQuestion({ ...newQuestion, score_type: e.target.value as "normal" | "double" })}
                    >
                      <option value="normal">Standard (1000)</option>
                      <option value="double">Double (2000)</option>
                    </select>
                  </div>
                </div>

                {/* Options */}
                <div>
                  <label
                    style={{
                      display: "block", fontWeight: 600,
                      fontSize: "0.875rem", marginBottom: 12,
                      color: "var(--text-primary)",
                    }}
                  >
                    Answer Options *
                    {newQuestion.type === "multiple_choice" && (
                      <span
                        style={{
                          marginLeft: 8, fontSize: "0.78rem",
                          color: "var(--text-muted)", fontWeight: 400,
                        }}
                      >
                        (select the correct answer)
                      </span>
                    )}
                    {newQuestion.type === "true_false" && (
                      <span
                        style={{
                          marginLeft: 8, fontSize: "0.78rem",
                          color: "var(--text-muted)", fontWeight: 400,
                        }}
                      >
                        (mark the correct answer)
                      </span>
                    )}
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {newQuestion.options.map((opt, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: `2px solid ${opt.is_correct ? "var(--accent)" : "var(--border)"}`,
                          background: opt.is_correct ? "var(--primary-muted)" : "var(--surface-alt)",
                          transition: "all 0.15s",
                        }}
                      >
                        {/* Radio */}
                        <input
                          type="radio"
                          name="correct_ans"
                          id={`opt-radio-${i}`}
                          checked={opt.is_correct}
                          onChange={() => updateOption(i, "is_correct", true)}
                          style={{ width: 18, height: 18, accentColor: "var(--primary)", flexShrink: 0 }}
                        />
                        {/* Option label badge */}
                        <span
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: getOptionColor(i).bg,
                            border: `1.5px solid ${getOptionColor(i).border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, fontSize: "0.75rem",
                            color: getOptionColor(i).dot,
                            flexShrink: 0,
                          }}
                        >
                          {OPT_LABELS[i]}
                        </span>
                        {/* Text input */}
                        <input
                          type="text"
                          placeholder={`Option ${i + 1}`}
                          required
                          disabled={newQuestion.type === "true_false"}
                          value={opt.content}
                          onChange={e => updateOption(i, "content", e.target.value)}
                          style={{
                            flex: 1, border: "none", background: "transparent",
                            outline: "none", fontSize: "0.9rem",
                            color: "var(--text-primary)", padding: 0,
                            cursor: newQuestion.type === "true_false" ? "not-allowed" : "text",
                            opacity: newQuestion.type === "true_false" ? 0.6 : 1,
                          }}
                        />
                        {opt.is_correct && (
                          <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.85rem", flexShrink: 0 }}>
                            ✓ Correct
                          </span>
                        )}
                        {/* Delete button for MTC options */}
                        {newQuestion.type === "multiple_choice" && newQuestion.options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOption(i)}
                            style={{
                              background: "var(--danger-light)",
                              color: "var(--danger)",
                              border: "1px solid #fca5a5",
                              padding: "4px 8px", borderRadius: 6,
                              cursor: "pointer", fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add option button for MTC */}
                  {newQuestion.type === "multiple_choice" && (
                    <button
                      type="button"
                      onClick={addOption}
                      style={{
                        marginTop: 10, padding: "10px 16px", borderRadius: 8,
                        border: "2px dashed var(--primary)",
                        background: "transparent",
                        color: "var(--primary)",
                        fontWeight: 600, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={closeQuestionModal}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingQuestion}
                    style={{ flex: 2 }}
                  >
                    {savingQuestion ? (
                      <><div className="spinner spinner-sm" /> Saving...</>
                    ) : (
                      editingQuestionId !== null ? "Update Question" : "Save Question"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
