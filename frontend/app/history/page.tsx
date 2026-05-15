"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import AuthGuard from "../components/AuthGuard";
import { historyApi } from "../../lib/api";
import type {
  UserHistoryResponse,
  PlayedSessionSummary,
  PlayedSessionDetail,
  HostedSessionHistory,
} from "../../lib/types";

type HistoryTab = "played" | "hosted";

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>("played");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Played sessions state
  const [playedSessions, setPlayedSessions] = useState<PlayedSessionSummary[]>([]);
  const [playedPagination, setPlayedPagination] = useState({ total: 0, page: 1, limit: 5, total_pages: 1 });
  const [playedLoading, setPlayedLoading] = useState(false);
  
  // Hosted sessions state
  const [hostedSessions, setHostedSessions] = useState<HostedSessionHistory[]>([]);
  const [hostedPagination, setHostedPagination] = useState({ total: 0, page: 1, limit: 5, total_pages: 1 });
  const [hostedLoading, setHostedLoading] = useState(false);
  
  const [expandedPlayed, setExpandedPlayed] = useState<number | null>(null);
  const [expandedHosted, setExpandedHosted] = useState<number | null>(null);
  const [playedDetails, setPlayedDetails] = useState<Record<number, PlayedSessionDetail>>({});
  const [loadingPlayedDetailId, setLoadingPlayedDetailId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState("");

  const loadHistoryPage = async (playedPage: number, hostedPage: number) => {
    try {
      setError("");
      setPlayedLoading(true);
      setHostedLoading(true);
      
      const { data } = await historyApi.me(5, playedPage, hostedPage) as { data: UserHistoryResponse };
      
      if (playedPage === 1) {
        setPlayedSessions(data.played_sessions);
      } else {
        setPlayedSessions((prev) => [...prev, ...data.played_sessions]);
      }
      setPlayedPagination(data.played_pagination);
      
      if (hostedPage === 1) {
        setHostedSessions(data.hosted_sessions);
      } else {
        setHostedSessions((prev) => [...prev, ...data.hosted_sessions]);
      }
      setHostedPagination(data.hosted_pagination);
    } catch {
      setError("Failed to load history.");
    } finally {
      setPlayedLoading(false);
      setHostedLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialHistory = async () => {
      try {
        setLoading(true);
        await loadHistoryPage(1, 1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitialHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadMorePlayed = async () => {
    const nextPage = playedPagination.page + 1;
    setPlayedPagination((prev) => ({ ...prev, page: nextPage }));
    await loadHistoryPage(nextPage, hostedPagination.page);
  };

  const handleLoadMoreHosted = async () => {
    const nextPage = hostedPagination.page + 1;
    setHostedPagination((prev) => ({ ...prev, page: nextPage }));
    await loadHistoryPage(playedPagination.page, nextPage);
  };

  const currentEmptyMessage = tab === "played"
    ? "You have not played any finished quiz yet."
    : "You have not hosted any finished room yet.";

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        <Navbar />

        <div className="container" style={{ paddingTop: 40, paddingBottom: 80, position: "relative" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-40px auto auto -120px",
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 68%)",
              filter: "blur(4px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: 900, marginBottom: 8, color: "var(--text-primary)" }}>
                History
              </h1>
              <p style={{ color: "var(--text-secondary)", maxWidth: 720 }}>
                Review the quizzes you have played and the rooms you have hosted, including answers, accuracy, and room performance.
              </p>
            </div>

            <Link href="/dashboard" className="btn btn-ghost">
              Back to Dashboard
            </Link>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
            <button
              className={`btn btn-sm ${tab === "played" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab("played")}
            >
              Played ({playedPagination.total})
            </button>
            <button
              className={`btn btn-sm ${tab === "hosted" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab("hosted")}
            >
              Hosted ({hostedPagination.total})
            </button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {loading ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              Loading history...
            </div>
          ) : tab === "played" ? (
            playedSessions.length === 0 ? (
              <div className="card" style={{ padding: 36, textAlign: "center" }}>
                <h3 style={{ marginBottom: 8, color: "var(--text-primary)" }}>No played history yet</h3>
                <p style={{ color: "var(--text-secondary)" }}>{currentEmptyMessage}</p>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 18 }}>
                  {playedSessions.map((session) => (
                    <PlayedSessionCard
                      key={session.session_id}
                      session={session}
                      expanded={expandedPlayed === session.session_id}
                      detail={playedDetails[session.session_id]}
                      loadingDetail={loadingPlayedDetailId === session.session_id}
                      detailError={detailError}
                      onToggle={async () => {
                        const nextExpanded = expandedPlayed === session.session_id ? null : session.session_id;
                        setExpandedPlayed(nextExpanded);
                        setDetailError("");

                        if (nextExpanded !== session.session_id) return;
                        if (playedDetails[session.session_id]) return;

                        setLoadingPlayedDetailId(session.session_id);
                        try {
                          const { data } = await historyApi.playedDetail(session.session_id) as { data: PlayedSessionDetail };
                          setPlayedDetails((prev) => ({ ...prev, [session.session_id]: data }));
                        } catch {
                          setDetailError("Failed to load quiz details.");
                        } finally {
                          setLoadingPlayedDetailId((current) => (current === session.session_id ? null : current));
                        }
                      }}
                    />
                  ))}
                </div>
                
                <div style={{ marginTop: 12, textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Page {playedPagination.page}/{playedPagination.total_pages} ({playedPagination.total} total)
                </div>
                
                {playedPagination.page < playedPagination.total_pages && (
                  <div style={{ marginTop: 24, textAlign: "center" }}>
                    <button
                      className="btn btn-outline"
                      onClick={handleLoadMorePlayed}
                      disabled={playedLoading}
                    >
                      {playedLoading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </>
            )
          ) : hostedSessions.length === 0 ? (
            <div className="card" style={{ padding: 36, textAlign: "center" }}>
              <h3 style={{ marginBottom: 8, color: "var(--text-primary)" }}>No hosted history yet</h3>
              <p style={{ color: "var(--text-secondary)" }}>{currentEmptyMessage}</p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 18 }}>
                {hostedSessions.map((session) => (
                  <HostedSessionCard
                    key={session.session_id}
                    session={session}
                    expanded={expandedHosted === session.session_id}
                    onToggle={() => setExpandedHosted(expandedHosted === session.session_id ? null : session.session_id)}
                  />
                ))}
              </div>
              
              {hostedPagination.page < hostedPagination.total_pages && (
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <button
                    className="btn btn-outline"
                    onClick={handleLoadMoreHosted}
                    disabled={hostedLoading}
                  >
                    {hostedLoading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function PlayedSessionCard({
  session,
  expanded,
  detail,
  loadingDetail,
  detailError,
  onToggle,
}: {
  session: PlayedSessionSummary;
  expanded: boolean;
  detail?: PlayedSessionDetail;
  loadingDetail: boolean;
  detailError: string;
  onToggle: () => void;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: 22,
          background: "transparent",
          border: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="badge badge-accent">Played</span>
              <span className="badge">Room {session.room_code}</span>
            </div>
            <h3 style={{ marginBottom: 8, color: "var(--text-primary)" }}>{session.quiz_title}</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
              Host: {session.host_username || "Unknown"} • {formatDateTime(session.ended_at)}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(110px, 1fr))", gap: 12, minWidth: 260 }}>
            <StatBox label="Accuracy" value={formatPercent(session.accuracy_percentage)} />
            <StatBox label="Avg time" value={formatSeconds(session.average_response_time_seconds)} />
            <StatBox label="Correct" value={String(session.correct_answers)} />
            <StatBox label="Wrong" value={String(session.wrong_answers)} />
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 22, background: "var(--surface-alt)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <span className="badge">{session.total_questions} questions</span>
            <span className="badge">{session.answered_questions} answered</span>
            <span className="badge">Top score: {session.top_players[0]?.score ?? 0}</span>
          </div>

          {detailError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>⚠️</span> {detailError}
            </div>
          )}

          {loadingDetail && !detail ? (
            <div className="card" style={{ padding: 20, textAlign: "center", boxShadow: "none" }}>
              Loading quiz details...
            </div>
          ) : detail?.questions?.length ? (
            <div style={{ display: "grid", gap: 14 }}>
              {detail.questions.map((question, index) => {
                const answeredLabel = question.selected_options.length > 0
                  ? question.selected_options.map((option) => option.content).join(", ")
                  : "No answer";
                const correctLabel = question.correct_options.length > 0
                  ? question.correct_options.map((option) => option.content).join(", ")
                  : "--";

                return (
                  <div key={question.question_id} className="card" style={{ padding: 18, boxShadow: "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 6 }}>
                          Q{index + 1} • {question.question_type}
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{question.question_content}</div>
                      </div>
                      <span className={`badge ${question.is_correct ? "badge-success" : "badge-danger"}`}>
                        {question.is_correct ? "Correct" : "Wrong"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gap: 8, color: "var(--text-secondary)", fontSize: "0.92rem" }}>
                      <div><strong>Your answer:</strong> {answeredLabel}</div>
                      <div><strong>Correct answer:</strong> {correctLabel}</div>
                      <div><strong>Score:</strong> {question.score_earned}</div>
                      <div><strong>Response time:</strong> {formatSeconds(question.response_time_seconds)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ padding: 20, textAlign: "center", boxShadow: "none" }}>
              No question details available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HostedSessionCard({
  session,
  expanded,
  onToggle,
}: {
  session: HostedSessionHistory;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: 22,
          background: "transparent",
          border: 0,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span className="badge badge-accent">Hosted</span>
              <span className="badge">Room {session.room_code}</span>
            </div>
            <h3 style={{ marginBottom: 8, color: "var(--text-primary)" }}>{session.quiz_title}</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
              {formatDateTime(session.ended_at)} • {session.participant_count} players
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(110px, 1fr))", gap: 12, minWidth: 280 }}>
            <StatBox label="Correct" value={formatPercent(session.correct_rate)} />
            <StatBox label="Wrong" value={formatPercent(session.wrong_rate)} />
            <StatBox label="Avg time" value={formatSeconds(session.average_response_time_seconds)} />
            <StatBox label="Answers" value={String(session.total_answers)} />
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 22, background: "var(--surface-alt)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 18 }}>
            <MiniMetric label="Quiz ID" value={String(session.quiz_id)} />
            <MiniMetric label="Started" value={formatDateTime(session.started_at)} />
            <MiniMetric label="Ended" value={formatDateTime(session.ended_at)} />
            <MiniMetric label="Top player" value={session.top_players[0]?.username ?? "--"} />
          </div>

          <div style={{ marginBottom: 14, fontWeight: 700, color: "var(--text-primary)" }}>Top players</div>
          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {session.top_players.map((player, index) => (
              <div
                key={player.user_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "white",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar avatar-sm" style={{ width: 28, height: 28, fontSize: "0.8rem" }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{player.username}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      {player.correct_answers} correct • {player.wrong_answers} wrong • {formatPercent(player.accuracy_percentage)}
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "var(--primary)" }}>{player.total_score}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatBox label="Total answers" value={String(session.total_answers)} />
            <StatBox label="Correct answers" value={String(session.correct_answers)} />
            <StatBox label="Wrong answers" value={String(session.wrong_answers)} />
            <StatBox label="Participants" value={String(session.participant_count)} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1rem" }}>{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "white", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}