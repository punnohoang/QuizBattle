"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/app/components/AuthGuard";
import { getWsUrl } from "@/lib/api";
import { GameplayQuestion } from "@/app/components/GameplayQuestion";
import { useWebSocket } from "@/lib/websocket";
import { useAuthStore, isGuestSession } from "@/lib/store";
import type { WSEvent, QuestionResponse, WSPlayer } from "@/lib/types";

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

const buildLeaderboardRows = (
  entries: Array<{ user_id: number; score: number; username?: string }> = [],
  roomPlayers: WSPlayer[] = [],
) => {
  const scoreByUser = new Map(entries.map((entry) => [entry.user_id, Number(entry.score) || 0]));
  const usernameByUser = new Map(entries.filter((entry) => entry.username).map((entry) => [entry.user_id, entry.username as string]));

  const rows = roomPlayers.length > 0
    ? roomPlayers.map((player) => ({
        user_id: player.user_id,
        username: usernameByUser.get(player.user_id) ?? player.username,
        score: scoreByUser.get(player.user_id) ?? 0,
      }))
    : entries.map((entry) => ({
        user_id: entry.user_id,
        username: entry.username ?? `Player ${entry.user_id}`,
        score: Number(entry.score) || 0,
      }));

  return rows.sort((a, b) => b.score - a.score);
};

export default function PlayRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { user } = useAuthStore();
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
  const [userResults, setUserResults] = useState<{ question_index: number; is_correct: boolean; score: number; content: string }[]>([]);
  const [answeredUsers, setAnsweredUsers] = useState<Set<number>>(new Set());

  const { lastMessage, sendEvent, players: wsPlayers, userId, isConnected, error: wsError, gameState } = useWebSocket(code);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Sync with shared game state on mount/update
  useEffect(() => {
    if (gameState.phase !== "waiting") {
      setPhase(gameState.phase as GamePhase);
    }
    if (gameState.question) {
      setQuestion(gameState.question);
      setQuestionNum(gameState.questionIndex + 1);
      setMaxTime(gameState.question.time_limit || 20);
      // Sync time left from shared state
      setTimeLeft(gameState.timeRemaining);
    }
    if (gameState.countdown !== undefined && gameState.phase === "countdown") {
      setCountdownVal(gameState.countdown);
    }
  }, [gameState]);

  // Update players list from WS
  useEffect(() => {
    if (wsPlayers.length > 0) {
      setPlayers(wsPlayers);
    }
  }, [wsPlayers]);

  // Handle errors from WS
  useEffect(() => {
    if (wsError) setError(wsError);
  }, [wsError]);

  // Handle incoming messages from shared WS - GAME EVENTS (SUBMIT ANSWER, WAIT FOR HOST TO START, COUNTDOWN, NEW QUESTION, TIMER TICK, ANSWER REVEAL, FINAL LEADERBOARD....)
  useEffect(() => {
    if (!lastMessage) return;
    
    const data = lastMessage;

    try {
      //1. Game starting countdown (3-2-1) - when host clicks start, all players need countdown
      if (data.event === "game_starting") {
        setPhase("countdown");
        if (data.countdown) setCountdownVal(data.countdown);
      }

      //2. Game started - ready for questions to come in (players perspective)
      if (data.event === "game_started") {
        setPhase("waiting");
      }

      //3. New question come in - start fresh with timer for that question
      if (data.event === "question_start" && data.question) {
        clearTimer();
        const q = data.question;
        setQuestion(q);
        setSelectedOption(null);
        setAnsweredUsers(new Set()); // Reset answered users for new question
        setPhase("question");
        const qIndex = data.question_index !== undefined ? data.question_index : questionNum;
        setQuestionNum(qIndex + 1);
        
        const limit = q.time_limit ?? 20;
        setMaxTime(limit);
        setTimeLeft(limit);

        // Optional: Local timer for smoothness, but will be corrected by question_timer events
        timerRef.current = setInterval(() => {
          setTimeLeft((t) => (t > 0 ? t - 1 : 0));
        }, 1000);
      }

      //4. Timer tick from backend (Sync point)
      if (data.event === "question_timer") {
        if (data.time_remaining !== undefined) {
          setTimeLeft(data.time_remaining);
        }
      }

      //5. Question time up (leaderboard update + show correct answer to players)
      if (data.event === "question_time_up") {
        clearTimer();

        if (userId !== null && !answeredUsers.has(userId)) {
          setAnsweredUsers(prev => new Set([...prev, userId]));
          sendEvent({
            event: "submit_answer",
            question_index: questionNum - 1,
            selected_option_ids: [],
            time_taken: maxTime,
          });
        }

        setPhase("answer_reveal");

        if (data.leaderboard) {
          setScores(buildLeaderboardRows(data.leaderboard, wsPlayers));
        }
        
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
      }

      // thực ra luồng của answer_reveal là đã cập nhật kết quả rồi
      // NO NEED FOR NOW ? ALL PLAYERS WILL GET THE ANSWER AT THE SAME TIME (question_time_up)
      // Individual answer result (from backend)
      if (data.event === "answer_result") {
        if (data.success && data.result) {
          const result = data.result;
          
          // Update the question options immediately so we know what's correct
          // if (result.correct_option_ids) {
          //   const correctIds = result.correct_option_ids.map(String);
          //   setQuestion(prev => {
          //     if (!prev) return prev;
          //     return {
          //       ...prev,
          //       options: prev.options.map(opt => ({
          //         ...opt,
          //         is_correct: correctIds.includes(String(opt.id))
          //       }))
          //     };
          //   });
          // }

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

      // Track player answered event (broadcast to all players)
      if (data.event === "player_answered") {
        if (data.user_id !== undefined) {
          setAnsweredUsers(prev => new Set([...prev, data.user_id]));
        }
        if (data.leaderboard) {
          setScores(buildLeaderboardRows(data.leaderboard, wsPlayers));
        }
      }

      // State recovery on reconnect (Anti-F5)
      if (data.event === "state_recovered" && data.state) {
        setIsRecovering(true);
        const state = data.state;
        
        const recoveredQuestion = state.question;
        const questionIndex = state.currentQuestion ?? state.question_index ?? 0;
        const timeRemaining = state.time_remaining ?? state.duration ?? 20;

        setQuestion(recoveredQuestion);
        setQuestionNum(questionIndex + 1);
        setPhase("question");
        setMaxTime(recoveredQuestion.time_limit ?? 20);
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

      // NOT USE YET
      if (data.event === "result") {
        clearTimer();
        setPhase("answer_reveal");
        if (data.scores) {
          const sorted = Object.entries(data.scores)
            .map(([uid, score]) => {
              const p = wsPlayers.find((p) => p.user_id === Number(uid));
              return { user_id: Number(uid), username: p?.username ?? `Player ${uid}`, score: Number(score) };
            })
            .sort((a, b) => b.score - a.score);
          setScores(sorted);
        }
      }

      if (data.event === "game_finished" || data.event === "game_end") {
        clearTimer();
        if (data.leaderboard) {
          setScores(buildLeaderboardRows(data.leaderboard, wsPlayers));
        }
        setPhase("final");
      }
    } catch (err) {
      console.error("Error processing WS message:", err);
    }
  }, [lastMessage, wsPlayers, questionNum, question?.content, maxTime]);

  // Set phase to waiting when connected
  useEffect(() => {
    if (isConnected && phase === "connecting") {
      setPhase("waiting");
    }
  }, [isConnected, phase]);

  // submit answer (can be before the time run out or after)
  const handleSelectOption = (optId: number) => {
    if (phase !== "question" || selectedOption !== null || userId === null) return;
    setSelectedOption(optId);
    
    // Calculate time taken
    const timeTaken = maxTime - timeLeft;
    
    setAnsweredUsers(prev => new Set([...prev, userId]));

    sendEvent({ 
      event: "submit_answer", 
      question_index: questionNum - 1,
      selected_option_ids: [optId],
      time_taken: timeTaken
    });
  };

  const finalLeaderboard = buildLeaderboardRows(scores, wsPlayers);

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
                {finalLeaderboard.map((s, i) => (
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
                {finalLeaderboard.length === 0 && (
                   <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                     No scores recorded.
                   </p>
                )}
              </div>
            </div>

            {/* Personal Scorecard */}
            {userResults.length > 0 && (
              <div className="animate-slideInUp" style={{ marginTop: 40, animationDelay: '0.2s' }}>
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
                onClick={() => {
                  if (isGuestSession()) {
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("guest_token");
                      sessionStorage.removeItem("guest_user");
                      sessionStorage.removeItem("guest_room_code");
                    }
                    router.push("/join");
                  } else {
                    router.push("/dashboard");
                  }
                }}
                className="btn btn-primary btn-lg"
              >
                {isGuestSession() ? "Leave Game" : "Back to Dashboard"}
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
          leaderboard={scores}
          selectedOption={selectedOption}
          phase={phase}
          isRecovering={isRecovering}
          answeredUsers={answeredUsers}
          onSelectOption={handleSelectOption}
        />
      </AuthGuard>
    );
  }
  // Fallback for unknown phase (should not reach here)
  return null;
}