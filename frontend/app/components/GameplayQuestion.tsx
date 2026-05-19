"use client";

import type { LeaderboardEntry, QuestionResponse, WSPlayer } from "@/lib/types";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CountdownTimer } from "./CountdownTimer";
import { AnswerOptions } from "./AnswerOptions";
import { ConfettiEffect } from "./ConfettiEffect";
import { playCorrectSound, playWrongSound, playSelectSound, unlockAudio } from "@/lib/sounds";

function AnimatedScoreValue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [scale, setScale] = useState(1);
  const currentValueRef = useRef(value);

  useEffect(() => {
    const fromValue = currentValueRef.current;
    const toValue = value;

    if (fromValue === toValue) {
      return;
    }

    if (toValue > fromValue) {
      setScale(1.08);
      requestAnimationFrame(() => setScale(1));
    }

    let rafId = 0;
    const duration = Math.min(900, Math.max(350, Math.abs(toValue - fromValue) * 18));
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(fromValue + (toValue - fromValue) * eased);

      setDisplayValue(nextValue);
      currentValueRef.current = nextValue;

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        currentValueRef.current = toValue;
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${scale})`,
        transformOrigin: "center",
        transition: "transform 180ms cubic-bezier(0.2, 1.2, 0.4, 1)",
      }}
    >
      {displayValue.toLocaleString()}
    </span>
  );
}

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
 * - Confetti + sound on correct answer
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
  const itemRefs = useRef(new Map<number, HTMLDivElement | null>());
  const previousRects = useRef(new Map<number, DOMRect>());

  // ─── Mobile leaderboard toggle ────────────────
  const [showMobileLeaderboard, setShowMobileLeaderboard] = useState(false);

  // ─── Confetti + sound state ───────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const soundFiredRef = useRef<string>("");   // tracks "q{n}-correct/wrong" to fire once

  // Unlock audio on first interaction
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  // Detect answer reveal & determine correct/wrong
  useEffect(() => {
    if (phase !== "answer_reveal" || selectedOption === null) return;

    const key = `q${questionNumber}-${selectedOption}`;
    if (soundFiredRef.current === key) return;
    soundFiredRef.current = key;

    const chosen = question.options.find((o) => o.id === selectedOption);
    if (chosen?.is_correct) {
      playCorrectSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    } else {
      playWrongSound();
    }
  }, [phase, selectedOption, question.options, questionNumber]);

  // Play select sound when option chosen
  const handleSelect = (optId: number) => {
    playSelectSound();
    onSelectOption(optId);
  };

  const leaderboardRows = useMemo(() => {
    const scoreByUser = new Map(leaderboard.map((entry) => [entry.user_id, Number(entry.score) || 0]));
    const base = players.length > 0
      ? players.map((player) => ({
          user_id: player.user_id,
          username: player.username,
          score: scoreByUser.get(player.user_id) ?? 0,
        }))
      : [...leaderboard];
    
    // Stable sort by score, then user_id to prevent "jumping" when scores are equal
    return base.sort((a, b) => b.score - a.score || a.user_id - b.user_id);
  }, [leaderboard, players]);

  useLayoutEffect(() => {
    const nextRects = new Map<number, DOMRect>();

    leaderboardRows.forEach((entry) => {
      const node = itemRefs.current.get(entry.user_id);
      if (!node) return;

      const nextRect = node.getBoundingClientRect();
      const previousRect = previousRects.current.get(entry.user_id);

      if (previousRect) {
        const deltaY = previousRect.top - nextRect.top;
        if (deltaY !== 0) {
          node.style.transition = "none";
          node.style.transform = `translateY(${deltaY}px)`;
          node.style.zIndex = "10";

          // Use double requestAnimationFrame to ensure the transform is applied before transition starts
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              node.style.transition = "transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)";
              node.style.transform = "translateY(0)";
              setTimeout(() => {
                if (node) node.style.zIndex = "";
              }, 400);
            });
          });
        }
      }

      nextRects.set(entry.user_id, nextRect);
    });

    previousRects.current = nextRects;
  }, [leaderboardRows]);

  return (<div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ─── Confetti overlay ─────────────────────── */}
      <ConfettiEffect active={showConfetti} />

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}>
        {/* ────── TOP BAR ────────────────────────── */}
        <div
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "var(--shadow-sm)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            width: "100%",
            gap: 8,
          }}
        >
          {/* Brand + Question # */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.85rem",
                fontWeight: 900,
                color: "white",
                flexShrink: 0,
              }}
            >
              ⚡
            </div>
            <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.95rem", display: "none" }} className="gq-brand">
              QuizBattle
            </span>
            <span
              style={{
                background: "var(--primary-muted)",
                color: "var(--primary)",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "1px solid var(--accent-light)",
                whiteSpace: "nowrap",
              }}
            >
              Q{questionNumber}
            </span>
          </div>

          {/* Timer */}
          <div style={{ position: "relative", flexShrink: 0 }}>
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
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "0.7rem",
                  fontWeight: 900,
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                  animation: "pulse 0.6s ease-in-out",
                }}
              >
                ✓
              </div>
            )}
          </div>

          {/* Right: Players count + mobile leaderboard toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
                padding: "5px 10px",
                background: "var(--primary-muted)",
                borderRadius: 999,
                border: "1px solid var(--accent-light)",
                whiteSpace: "nowrap",
              }}
            >
              <span>👥</span>
              <span>{answeredUsers.size}/{players.length}</span>
            </div>
            {/* Mobile-only leaderboard toggle */}
            <button
              className="gq-lb-toggle"
              onClick={() => setShowMobileLeaderboard((v) => !v)}
              style={{
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1px solid var(--accent-light)",
                background: showMobileLeaderboard ? "var(--primary)" : "var(--primary-muted)",
                color: showMobileLeaderboard ? "white" : "var(--primary)",
                cursor: "pointer",
                fontSize: "1rem",
                flexShrink: 0,
              }}
              aria-label="Toggle leaderboard"
            >
              🏆
            </button>
          </div>
        </div>

        <div className="gameplay-shell" style={{ flex: 1 }}>
          <div className="gameplay-main">
            {/* ────── CONTENT AREA (Questions, Options) ────── */}
            <div className="gameplay-content" style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
              {/* Center Area: Question */}
              <div
                style={{
                  padding: "28px 16px 16px",
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
                      padding: "5px 14px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      marginBottom: 16,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    <span>⭐</span>
                    <span>Double Points</span>
                  </div>
                )}

                <h2
                  style={{
                    fontSize: "clamp(1.1rem, 4vw, 1.875rem)",
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
                  padding: "0 16px 32px",
                }}
              >
                <AnswerOptions
                  options={question.options}
                  selectedOption={selectedOption}
                  phase={phase}
                  onSelect={handleSelect}
                />
              </div>
            </div>
          </div>

          {/* Right Area: Sidebar (desktop always, mobile toggled) */}
          <aside className={`gameplay-sidebar${showMobileLeaderboard ? " gq-lb-open" : ""}`}>
            <div className="leaderboard-card">
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.12em" }}>
                  LIVE LEADERBOARD
                </div>
                <h3 style={{ margin: "4px 0 0", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                  Current standings
                </h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 6 }}>
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
                        ref={(node) => {
                          itemRefs.current.set(entry.user_id, node);
                        }}
                        style={{
                          willChange: "transform",
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
                          <div style={{ fontSize: "1.05rem", lineHeight: 1 }}>
                            <AnimatedScoreValue value={entry.score} />
                          </div>
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
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--success)",
            color: "white",
            padding: "10px 24px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: "0.9rem",
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

      {/* ────── CORRECT ANSWER FLASH OVERLAY ──── */}
      {showConfetti && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9998,
            animation: "gq-flash 0.5s ease-out forwards",
            background: "rgba(16, 217, 160, 0.12)",
          }}
        />
      )}

      <style>{`
        @keyframes gq-flash {
          0%   { opacity: 1 }
          100% { opacity: 0 }
        }

        /* Mobile: show toggle button, hide brand text */
        @media (max-width: 768px) {
          .gq-lb-toggle { display: flex !important; }
          .gq-brand { display: none !important; }

          /* Mobile leaderboard: hidden by default, slides up when open */
          .gameplay-sidebar {
            display: none;
            width: 100%;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            top: auto !important;
            z-index: 200 !important;
            max-height: 55vh;
            overflow-y: auto;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
            animation: gq-slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1);
          }
          .gameplay-sidebar.gq-lb-open {
            display: block;
          }
          @keyframes gq-slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }

          /* Mobile: full-width content, smaller padding */
          .gameplay-content {
            max-width: 100% !important;
          }
          .gameplay-shell {
            padding-bottom: 80px; /* space for answer locked toast */
          }
        }

        /* Desktop: always show brand */
        @media (min-width: 769px) {
          .gq-brand { display: inline !important; }
          .gq-lb-toggle { display: none !important; }
        }
      `}</style>
    </div>
  );
}
