"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../../components/AuthGuard";
import { getWsUrl } from "../../../../lib/api";
import { GameplayQuestion } from "../../../components/GameplayQuestion";
import type { WSEvent, QuestionResponse, WSPlayer } from "../../../../lib/types";

interface StateRecovery {
  question_index: number;
  question: QuestionResponse;
  time_remaining: number;
  is_answered: boolean;
  snapshot_at: string;
}

type GamePhase = "connecting" | "waiting" | "countdown" | "question" | "answer_reveal" | "final";

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
  const [countdownVal, setCountdownVal] = useState(3);
  const [isRecovering, setIsRecovering] = useState(false);
  const [userResults, setUserResults] = useState<Array<{ question_index: number; is_correct: boolean; score: number; content: string }>>([]);

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

        // Player join/leave events
        if (data.event === "player_joined" || data.event === "player_left") {
          if (data.participants) setPlayers(data.participants);
        }

        // Game starting countdown (3-2-1)
        if (data.event === "game_starting") {
          setPhase("countdown");
          if (data.countdown) setCountdownVal(data.countdown);
        }

        // Game started - ready for questions
        if (data.event === "game_started") {
          setPhase("waiting");
        }

        // New question - start fresh with timer
        if (data.event === "question_start" && data.question) {
          clearTimer();
          const q = data.question;
          setQuestion(q);
          setSelectedOption(null);
          setPhase("question");
          if (typeof data.question_index === 'number') {
            setQuestionNum(data.question_index + 1);
          } else {
            setQuestionNum((n: number) => n + 1);
          }
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

        // Timer tick from backend (overrides client timer for anti-F5)
        if (data.event === "question_timer") {
          if (data.time_remaining !== undefined) {
            setTimeLeft(data.time_remaining);
          }
        }

        // Question time up
        if (data.event === "question_time_up") {
          clearTimer();
          setPhase("answer_reveal");
          
          // IMPORTANT: Update the options in current question to show correct/wrong
          if (data.correct_answer && Array.isArray(data.correct_answer)) {
            const correctIds = data.correct_answer.map(String);
            setQuestion(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                options: prev.options.map(opt => ({
                  ...opt,
                  is_correct: correctIds.includes(String(opt.id))
                }))
              };
            });
          }

          // Update leaderboard if provided
          if (data.leaderboard) {
            // Live leaderboard update could go here
          }
        }

        // Individual answer result (from backend)
        if (data.event === "answer_result") {
          if (data.success && data.result) {
            const result = data.result;
            
            // Update the question options immediately so we know what's correct
            if (result.correct_option_ids) {
              const correctIds = result.correct_option_ids.map(String);
              setQuestion(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  options: prev.options.map(opt => ({
                    ...opt,
                    is_correct: correctIds.includes(String(opt.id))
                  }))
                };
              });
            }

            setUserResults(prev => {
              if (prev.find(r => r.question_index === result.question_index)) return prev;
              return [...prev, {
                question_index: result.question_index,
                is_correct: result.is_correct,
                score: result.score,
                content: question?.content || `Question ${result.question_index + 1}`
              }];
            });
          }
        }

        // State recovery on reconnect (Anti-F5)
        if (data.event === "state_recovered" && data.state) {
          setIsRecovering(true);
          const state = data.state;
          
          // Align with new Key 5 structure
          const question = state.question;
          const questionIndex = state.currentQuestion ?? state.question_index ?? 0;
          const timeRemaining = state.time_remaining ?? state.duration ?? 20;

          setQuestion(question);
          setQuestionNum(questionIndex + 1);
          setPhase("question");
          setMaxTime(question.time_limit ?? 20);
          setTimeLeft(timeRemaining);
          setSelectedOption(null);

          // Resume timer
          clearTimer();
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

          setTimeout(() => setIsRecovering(false), 2000);
        }

        // Old "question" event fallback for compatibility
        if (data.event === "question" && data.question) {
          clearTimer();
          const q = data.question;
          setQuestion(q);
          setSelectedOption(null);
          setPhase("question");
          if (typeof data.question_index === 'number') {
            setQuestionNum(data.question_index + 1);
          } else {
            setQuestionNum((n: number) => n + 1);
          }
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

        if (data.event === "game_finished" || data.event === "game_end") {
          clearTimer();
          if (data.leaderboard) {
            const sorted = data.leaderboard.map((entry: any) => {
              const p = players.find((p) => p.user_id === entry.user_id);
              return { 
                user_id: entry.user_id, 
                username: p?.username || `Player ${entry.user_id}`, 
                score: entry.score 
              };
            }).sort((a: any, b: any) => b.score - a.score);
            setScores(sorted);
          }
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
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [code]);

  const handleSelectOption = (optId: number) => {
    if (phase !== "question" || selectedOption !== null) return;
    setSelectedOption(optId);
    
    // Calculate time taken
    const timeTaken = maxTime - timeLeft;
    
    wsRef.current?.send(JSON.stringify({ 
      event: "submit_answer", 
      question_index: questionNum - 1,
      selected_option_ids: [optId],
      time_taken: timeTaken
    }));
  };

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

            {/* Personal Scorecard */}
            {userResults.length > 0 && (
              <div style={{ marginTop: 40 }} className="animate-slideInUp" style={{ animationDelay: '0.2s' }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, textAlign: 'center' }}>
                  Your Performance
                </h3>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>QUESTION</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>RESULT</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>POINTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userResults.sort((a,b) => a.question_index - b.question_index).map((res, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === userResults.length - 1 ? 'none' : '1px solid var(--border)' }}>
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>
                            <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {res.content}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 24, height: 24, borderRadius: '50%',
                              background: res.is_correct ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: res.is_correct ? '#10b981' : '#ef4444',
                              fontSize: '0.8rem', fontWeight: 900
                            }}>
                              {res.is_correct ? '✓' : '✗'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: res.is_correct ? 'var(--primary)' : 'var(--text-muted)' }}>
                            +{res.score}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--primary-muted)', borderTop: '2px solid var(--primary)' }}>
                        <td colSpan={3} style={{ padding: '16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>Total Score:</td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 900, color: 'var(--primary)', fontSize: '1.2rem' }}>
                          {userResults.reduce((acc, curr) => acc + curr.score, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

  /* ── COUNTDOWN (3-2-1) ────────────────────── */
  if (phase === "countdown") {
    return (
      <AuthGuard>
        <div
          style={{
            minHeight: "100vh",
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: "clamp(4rem, 20vw, 12rem)",
              fontWeight: 900,
              color: "white",
              animation: `pulse 0.6s ease-out, scale 0.6s ease-out`,
              textShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            {countdownVal}
          </div>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.2rem", fontWeight: 600 }}>
            Get ready!
          </p>
        </div>
      </AuthGuard>
    );
  }

  /* ── QUESTION / ANSWER REVEAL ─────────────── */
  if (phase === "question" || phase === "answer_reveal") {
    return (
      <AuthGuard>
        <GameplayQuestion
          question={question!}
          questionNumber={questionNum}
          timeLeft={timeLeft}
          maxTime={maxTime}
          players={players}
          selectedOption={selectedOption}
          phase={phase}
          isRecovering={isRecovering}
          onSelectOption={handleSelectOption}
        />
      </AuthGuard>
    );
  }
  // Fallback for unknown phase (should not reach here)
  return null;
}