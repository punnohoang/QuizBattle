"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../../components/AuthGuard";
import { getWsUrl } from "../../../../lib/api";
import type { WSEvent, QuestionResponse, WSPlayer } from "../../../../lib/types";

const OPT_LABELS = ["A", "B", "C", "D"];

const OPT_STYLES = [
  { bg: "linear-gradient(135deg, #2563eb, #1d4ed8)", shadow: "0 4px 16px rgba(37,99,235,0.3)" },
  { bg: "linear-gradient(135deg, #059669, #047857)", shadow: "0 4px 16px rgba(5,150,105,0.3)" },
  { bg: "linear-gradient(135deg, #d97706, #b45309)", shadow: "0 4px 16px rgba(217,119,6,0.3)" },
  { bg: "linear-gradient(135deg, #dc2626, #b91c1c)", shadow: "0 4px 16px rgba(220,38,38,0.3)" },
];

type GamePhase = "connecting" | "waiting" | "question" | "answer_reveal" | "final";

interface Score {
  user_id: number;
  username: string;
  score: number;
}

export default function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { code } = use(params);

  const [phase, setPhase] = useState<GamePhase>("connecting");
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [maxTime, setMaxTime] = useState(20);
  const [players, setPlayers] = useState<WSPlayer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState("");
  const [questionNum, setQuestionNum] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!code) return;

    const socket = new WebSocket(getWsUrl(code));
    wsRef.current = socket;

    socket.onopen = () => setPhase("waiting");

    socket.onmessage = (event) => {
      try {
        const data: WSEvent = JSON.parse(event.data);

        if (data.event === "player_joined" || data.event === "player_left") {
          if (data.participants) setPlayers(data.participants);
        }

        if (data.event === "question" && data.question) {
          clearTimer();
          const q = data.question;
          setQuestion(q);
          setSelectedOption(null);
          setPhase("question");
          setQuestionNum((n) => n + 1);
          const limit = q.time_limit ?? 20;
          setMaxTime(limit);
          setTimeLeft(limit);

          timerRef.current = setInterval(() => {
            setTimeLeft((t) => {
              if (t <= 1) {
                clearTimer();
                setPhase("answer_reveal");
                return 0;
              }
              return t - 1;
            });
          }, 1000);
        }

        if (data.event === "result") {
          clearTimer();
          setPhase("answer_reveal");
          if (data.scores) {
            const sorted = Object.entries(data.scores)
              .map(([uid, score]) => {
                const p = players.find((p) => p.user_id === Number(uid));
                return { user_id: Number(uid), username: p?.username ?? `Player ${uid}`, score };
              })
              .sort((a, b) => b.score - a.score);
            setScores(sorted);
          }
        }

        if (data.event === "game_end") {
          clearTimer();
          setPhase("final");
        }
      } catch {
        /* ignore parse errors */
      }
    };

    socket.onclose = (e) => {
      if (e.code === 1008) setError("Unauthorized or invalid room.");
    };
    socket.onerror = () => setError("WebSocket error occurred.");

    return () => {
      clearTimer();
      socket.close();
    };
  }, [code]);

  const handleSelectOption = (optId: number) => {
    if (phase !== "question" || selectedOption !== null) return;
    setSelectedOption(optId);
    wsRef.current?.send(JSON.stringify({ event: "answer", option_id: optId }));
  };

  // Timer ring calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / maxTime;
  const dashOffset = circumference * (1 - progress);
  const timerColor =
    timeLeft > maxTime * 0.5 ? "#2563eb" : timeLeft > maxTime * 0.25 ? "#d97706" : "#dc2626";

  /* ── ERROR ───────────────────────────────────── */
  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "var(--background)", padding: 24,
        }}
      >
        <div className="card" style={{ textAlign: "center", maxWidth: 380, padding: "2.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>❌</div>
          <h2 style={{ marginBottom: 8, color: "var(--text-primary)" }}>Connection Error</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{error}</p>
          <button onClick={() => router.push("/dashboard")} className="btn btn-primary btn-block">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ── FINAL SCOREBOARD ─────────────────────── */
  if (phase === "final") {
    return (
      <AuthGuard>
        <div style={{ minHeight: "100vh", background: "var(--background)", padding: "60px 24px" }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }} className="animate-slideInUp">
            {/* Trophy header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontSize: "3.5rem", marginBottom: 12, animation: "pulse 2s infinite" }}>🏆</div>
              <h1 style={{ fontSize: "2.5rem", fontWeight: 900, color: "var(--primary)", marginBottom: 6 }}>
                Game Over!
              </h1>
              <p style={{ color: "var(--text-secondary)" }}>Final Leaderboard</p>
            </div>

            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {scores.map((s, i) => (
                  <div
                    key={s.user_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: i === 0
                        ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                        : i === 1
                        ? "linear-gradient(135deg, #f1f5f9, #e2e8f0)"
                        : i === 2
                        ? "linear-gradient(135deg, #fef3e8, #fed7aa)"
                        : "var(--surface-alt)",
                      border: `1px solid ${i === 0 ? "#fcd34d" : i === 1 ? "#cbd5e1" : i === 2 ? "#fdba74" : "var(--border)"}`,
                      transition: "transform 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 36, height: 36,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: i < 3 ? "1.4rem" : "1rem",
                        fontWeight: 800,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </div>
                    <div className="avatar">
                      {s.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, fontWeight: 600, color: "var(--text-primary)" }}>
                      {s.username}
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        color: i === 0 ? "#b45309" : "var(--primary)",
                      }}
                    >
                      {s.score.toLocaleString()} pts
                    </div>
                  </div>
                ))}
                {scores.length === 0 && (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                    No scores recorded.
                  </p>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 28 }}>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn btn-primary btn-lg"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  /* ── CONNECTING / WAITING ─────────────────── */
  if (phase === "connecting" || phase === "waiting") {
    return (
      <AuthGuard>
        <div
          style={{
            minHeight: "100vh",
            background: "var(--background)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 24,
          }}
        >
          <div
            style={{
              width: 72, height: 72, borderRadius: 20,
              background: "var(--gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem", boxShadow: "var(--shadow-primary)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >⚡</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ color: "var(--primary)", marginBottom: 8 }}>
              {phase === "connecting" ? "Connecting to game..." : "Waiting for host to start..."}
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Room: <strong style={{ fontFamily: "monospace", color: "var(--primary)" }}>{code}</strong>
            </p>
          </div>
          {players.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {players.map((p) => (
                <div key={p.user_id} className="player-chip">
                  <div className="avatar avatar-sm">{p.username.charAt(0).toUpperCase()}</div>
                  {p.username}
                </div>
              ))}
            </div>
          )}
          <div className="spinner" />
        </div>
      </AuthGuard>
    );
  }

  /* ── QUESTION / ANSWER REVEAL ─────────────── */
  return (
    <AuthGuard>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Bar */}
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
          }}
        >
          {/* Left: brand + question number */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "var(--gradient-primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.9rem",
              }}
            >⚡</div>
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
              Q{questionNum}
            </span>
          </div>

          {/* Center: circular timer */}
          <svg width="72" height="72" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="7"
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={timerColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="timer-ring"
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
            />
            <text
              x="50" y="56"
              textAnchor="middle"
              fill={timerColor}
              fontSize="24"
              fontWeight="800"
              fontFamily="Inter, sans-serif"
            >
              {timeLeft}
            </text>
          </svg>

          {/* Right: players count */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            <span>👥</span>
            <span>{players.length} players</span>
          </div>
        </div>

        {/* Question */}
        <div
          style={{
            padding: "36px 24px 24px",
            textAlign: "center",
            maxWidth: 760,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {question?.score_type === "double" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                color: "#92400e",
                borderRadius: 999,
                padding: "4px 14px",
                fontSize: "0.8rem",
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              ⭐ Double Points
            </div>
          )}
          <h2
            style={{
              fontSize: "clamp(1.2rem, 3.5vw, 1.75rem)",
              fontWeight: 700,
              lineHeight: 1.45,
              color: "var(--text-primary)",
              marginBottom: 0,
            }}
          >
            {question?.content}
          </h2>
        </div>

        {/* Options */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px 48px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            {question?.options.map((opt, i) => {
              const isSelected = selectedOption === opt.id;
              const isCorrect = phase === "answer_reveal" && opt.is_correct;
              const isWrong = phase === "answer_reveal" && isSelected && !opt.is_correct;

              let borderOverride = "2px solid transparent";
              if (isCorrect) borderOverride = "3px solid #059669";
              else if (isWrong) borderOverride = "3px solid #dc2626";
              else if (isSelected) borderOverride = "3px solid white";

              const opacityVal =
                phase === "answer_reveal" && !isCorrect && !isSelected ? 0.45 : 1;

              return (
                <button
                  key={opt.id}
                  className="answer-opt"
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={phase !== "question"}
                  style={{
                    background: OPT_STYLES[i].bg,
                    boxShadow: isSelected ? "none" : OPT_STYLES[i].shadow,
                    border: borderOverride,
                    opacity: opacityVal,
                    transform: isSelected ? "scale(0.97)" : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 34, height: 34,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "0.875rem",
                      flexShrink: 0,
                    }}
                  >
                    {phase === "answer_reveal" && isCorrect
                      ? "✓"
                      : phase === "answer_reveal" && isWrong
                      ? "✗"
                      : OPT_LABELS[i]}
                  </span>
                  <span style={{ fontSize: "clamp(0.875rem, 2vw, 1rem)", lineHeight: 1.4 }}>
                    {opt.content}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Locked in toast */}
        {selectedOption !== null && phase === "question" && (
          <div
            style={{
              position: "fixed",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--primary)",
              color: "white",
              padding: "12px 28px",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: "0.95rem",
              boxShadow: "var(--shadow-primary)",
              animation: "slideInUp 0.3s ease-out",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ✅ Answer locked in!
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
