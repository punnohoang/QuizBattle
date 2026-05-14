"use client";

import type { QuestionResponse, WSPlayer } from "@/lib/types";
import { CountdownTimer } from "./CountdownTimer";
import { AnswerOptions } from "./AnswerOptions";

interface GameplayQuestionProps {
  question: QuestionResponse;
  questionNumber: number;
  timeLeft: number;
  maxTime: number;
  players: WSPlayer[];
  selectedOption: number | null;
  phase: "question" | "answer_reveal";
  isRecovering: boolean;
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
  selectedOption,
  phase,
  isRecovering,
  onSelectOption,
}: GameplayQuestionProps) {
  const isLowTime = timeLeft <= maxTime * 0.25;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
        }}
      >
        {/* Left: Brand + Question Counter */}
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

        {/* Center: Circular Timer */}
        <div style={{ position: "relative" }}>
          <CountdownTimer
            timeLeft={timeLeft}
            maxTime={maxTime}
            isLowTime={isLowTime}
          />

          {/* Recovery indicator badge */}
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

        {/* Right: Players Count */}
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

      {/* ────── QUESTION CONTENT ────────────────── */}
      <div
        style={{
          padding: "36px 24px 24px",
          textAlign: "center",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Double Points Badge */}
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

        {/* Question Text */}
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

      {/* ────── ANSWER OPTIONS ────────────────── */}
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
