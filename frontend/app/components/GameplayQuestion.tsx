"use client";

import type { LeaderboardEntry, QuestionResponse, WSPlayer } from "@/lib/types";
import { CountdownTimer } from "./CountdownTimer";
import { AnswerOptions } from "./AnswerOptions";

interface GameplayQuestionProps {
  question: QuestionResponse;
  questionNumber: number;
  timeLeft: number;
  maxTime: number;
  players: WSPlayer[];
  leaderboard: LeaderboardEntry[];
  selectedOption: number | null;
  phase: "question" | "answer_reveal";
  isRecovering: boolean;
  answeredUsers: Set<number>;
  onSelectOption: (optionId: number) => void;
}

/**
 * Main gameplay screen showing:
 * - Question text with double points indicator
 * - Circular countdown timer with color transitions
 * - 4 colored answer options
 * - Player count and recovery indicator
 */
export function GameplayQuestion({
  question,
  questionNumber,
  timeLeft,
  maxTime,
  players,
  leaderboard,
  selectedOption,
  phase,
  isRecovering,
  answeredUsers,
  onSelectOption,
}: GameplayQuestionProps) {
  const isLowTime = timeLeft <= maxTime * 0.25;
  const scoreByUser = new Map(leaderboard.map((entry) => [entry.user_id, Number(entry.score) || 0]));
  const leaderboardRows = players.length > 0
    ? players.map((player) => ({
        user_id: player.user_id,
        username: player.username,
        score: scoreByUser.get(player.user_id) ?? 0,
      })).sort((a, b) => b.score - a.score)
    : [...leaderboard].sort((a, b) => b.score - a.score);

  return (<div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}>
        {/* ────── TOP BAR ────────────────────────── */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--shadow-sm)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.9rem",
                fontWeight: 900,
                color: "white",
              }}
            >
              ⚡
            </div>
            <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "1rem" }}>
              QuizBattle
            </span>
            <span
              style={{
                background: "var(--primary-muted)",
                color: "var(--primary)",
                borderRadius: 999,
                padding: "3px 12px",
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "1px solid var(--accent-light)",
              }}
            >
              Q{questionNumber}
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <CountdownTimer
              timeLeft={timeLeft}
              maxTime={maxTime}
              isLowTime={isLowTime}
            />

            {isRecovering && (
              <div
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                  animation: "pulse 0.6s ease-in-out",
                }}
              >
                ✓
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              fontWeight: 600,
              padding: "6px 12px",
              background: "var(--primary-muted)",
              borderRadius: 999,
              border: "1px solid var(--accent-light)",
            }}
          >
            <span>👥</span>
            <span>{players.length} players</span>
          </div>
        </div>

        <div className="gameplay-shell" style={{ flex: 1 }}>
          <div className="gameplay-main">
            {/* ────── CONTENT AREA (Questions, Options) ────── */}
            <div className="gameplay-content" style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
              {/* Center Area: Question */}
              <div
                style={{
                  padding: "36px 24px 24px",
                  textAlign: "center",
                  maxWidth: 760,
                  margin: "0 auto",
                  width: "100%",
                }}
              >
                {question.score_type === "double" && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#fef3c7",
                      border: "1.5px solid #fcd34d",
                      color: "#92400e",
                      borderRadius: 999,
                      padding: "6px 16px",
                      fontSize: "0.825rem",
                      fontWeight: 700,
                      marginBottom: 20,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    <span>⭐</span>
                    <span>Double Points</span>
                  </div>
                )}

                <h2
                  style={{
                    fontSize: "clamp(1.3rem, 4vw, 1.875rem)",
                    fontWeight: 700,
                    lineHeight: 1.5,
                    color: "var(--text-primary)",
                    marginBottom: 0,
                  }}
                >
                  {question.content}
                </h2>
              </div>

              {/* Center Area: Options */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 24px 48px",
                }}
              >
                <AnswerOptions
                  options={question.options}
                  selectedOption={selectedOption}
                  phase={phase}
                  onSelect={onSelectOption}
                />
              </div>
            </div>
          </div>

          {/* Right Area: Sidebar */}
          <aside className="gameplay-sidebar">
            <div className="leaderboard-card">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.12em" }}>
                  LIVE LEADERBOARD
                </div>
                <h3 style={{ margin: "4px 0 0", fontSize: "1.1rem", color: "var(--text-primary)" }}>
                  Current standings
                </h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 6 }}>
                  {answeredUsers.size} / {players.length} answered
                </div>
              </div>

              <div className="leaderboard-list">
                {leaderboardRows.length > 0 ? (
                  leaderboardRows.map((entry, index) => {
                    const player = players.find((p) => p.user_id === entry.user_id);
                    const username = player?.username || entry.username || `Player ${entry.user_id}`;
                    const rank = index + 1;
                    const rankLabel = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                    const hasAnswered = answeredUsers.has(entry.user_id);

                    return (
                      <div
                        key={entry.user_id}
                        className="leaderboard-item"
                        style={{
                          background:
                            hasAnswered
                              ? "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(37, 99, 235, 0.03))"
                              : rank === 1
                                ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                                : rank === 2
                                  ? "linear-gradient(135deg, #f1f5f9, #e2e8f0)"
                                  : rank === 3
                                    ? "linear-gradient(135deg, #fef3e8, #fed7aa)"
                                    : "var(--surface-alt)",
                            borderColor: hasAnswered
                            ? "rgba(59, 130, 246, 0.45)"
                            : rank === 1
                              ? "#fcd34d"
                              : rank === 2
                                ? "#cbd5e1"
                                : rank === 3
                                  ? "#fdba74"
                                  : "transparent",
                            borderWidth: hasAnswered ? "2px" : "1px",
                          borderStyle: "solid",
                            boxShadow: hasAnswered ? "0 0 0 1px rgba(59, 130, 246, 0.10), 0 0 18px rgba(59, 130, 246, 0.16)" : "none",
                            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                        }}
                      >
                        <div className="leaderboard-score">
                          <div style={{ fontSize: "1.05rem", lineHeight: 1 }}>{entry.score.toLocaleString()}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>PTS</div>
                        </div>

                        <div className="leaderboard-avatar-stack">
                          <div className="avatar avatar-sm" style={{ boxShadow: "none" }}>
                            {username.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                            <div className="leaderboard-name">{username}</div>
                          </div>
                        </div>

                        <div style={{ marginLeft: "auto", fontWeight: 800, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                          {rankLabel}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="leaderboard-empty">
                    <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>👥</div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                      Waiting for scores...
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", textAlign: "center" }}>
                      The leaderboard will update after each question ends.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
      </div>

          </div>

      {/* ────── ANSWER LOCKED TOAST ────────────── */}
      {selectedOption !== null && phase === "question" && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--success)",
            color: "white",
            padding: "12px 28px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: "0.95rem",
            boxShadow: "0 4px 16px rgba(5, 150, 105, 0.3)",
            animation: "slideInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 100,
          }}
        >
          <span>✅</span>
          <span>Answer locked in!</span>
        </div>
      )}
    </div>
  );
}
