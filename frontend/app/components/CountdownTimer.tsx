"use client";

import { useEffect, useRef } from "react";

interface CountdownTimerProps {
  timeLeft: number;
  maxTime: number;
  isLowTime?: boolean;
  size?: number;
}

/**
 * Circular countdown timer component with color transitions:
 * - Teal/Green: 50%–100% time remaining
 * - Amber: 25%–50% time remaining
 * - Red: 0–25% time remaining (pulsing glow + shake)
 */
export function CountdownTimer({
  timeLeft,
  maxTime,
  isLowTime,
  size = 80,
}: CountdownTimerProps) {
  const radius = 38;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, timeLeft / maxTime));
  const dashOffset = circumference * (1 - progress);

  const isDanger = timeLeft <= maxTime * 0.25;
  const isWarning = timeLeft > maxTime * 0.25 && timeLeft <= maxTime * 0.5;

  const timerColor = isDanger
    ? "var(--clr-danger)"
    : isWarning
      ? "var(--clr-warning)"
      : "var(--clr-safe)";

  const glowColor = isDanger
    ? "drop-shadow(0 0 10px var(--clr-danger-glow))"
    : isWarning
      ? "drop-shadow(0 0 6px var(--clr-warning-glow))"
      : "none";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@500;700&display=swap');

        .countdown-root {
          --clr-safe:         #10d9a0;
          --clr-safe-track:   rgba(16, 217, 160, 0.12);
          --clr-warning:      #f59e0b;
          --clr-warning-glow: rgba(245, 158, 11, 0.55);
          --clr-danger:       #f43f5e;
          --clr-danger-glow:  rgba(244, 63, 94, 0.60);
          --clr-bg:           rgba(255,255,255,0.04);
          --clr-track:        rgba(255,255,255,0.10);
          --clr-text-muted:   rgba(255,255,255,0.35);
          --font-mono:        'DM Mono', ui-monospace, monospace;
        }

        /* ── wrapper ─────────────────────────────────────────── */
        .countdown-root {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        /* ── frosted glass backdrop ──────────────────────────── */
        .countdown-backdrop {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--clr-bg);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        /* ── svg ─────────────────────────────────────────────── */
        .countdown-svg {
          position: relative;
          z-index: 1;
          display: block;
          overflow: visible;
        }

        /* ── track ring ──────────────────────────────────────── */
        .countdown-track {
          fill: none;
          stroke: var(--clr-track);
          stroke-width: 6;
        }

        /* ── progress ring ───────────────────────────────────── */
        .countdown-ring {
          fill: none;
          stroke-width: 6;
          stroke-linecap: round;
          transform-origin: 50px 50px;
          transform: rotate(-90deg);
          transition:
            stroke-dashoffset 1s linear,
            stroke 0.4s ease,
            filter 0.4s ease;
        }

        /* ── center number ───────────────────────────────────── */
        .countdown-label {
          font-family: var(--font-mono);
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.5px;
          dominant-baseline: middle;
          text-anchor: middle;
          transition: fill 0.4s ease;
          user-select: none;
        }

        /* ── danger: pulsing glow ring behind SVG ────────────── */
        .countdown-danger-glow {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(
            circle,
            rgba(244, 63, 94, 0.18) 0%,
            transparent 68%
          );
          animation: danger-breathe 0.9s ease-in-out infinite;
        }

        /* ── danger: number pulse ────────────────────────────── */
        .countdown-label.is-danger {
          animation: label-pulse 0.65s ease-in-out infinite;
        }

        /* ── warning: subtle shimmer on number ───────────────── */
        .countdown-label.is-warning {
          animation: label-shimmer 1.4s ease-in-out infinite;
        }

        /* ─── keyframes ──────────────────────────────────────── */
        @keyframes danger-breathe {
          0%, 100% { opacity: 0.55; transform: scale(1);    }
          50%       { opacity: 1;    transform: scale(1.08); }
        }

        @keyframes label-pulse {
          0%, 100% { opacity: 1;    transform: scale(1);    }
          50%       { opacity: 0.65; transform: scale(0.93); }
        }

        @keyframes label-shimmer {
          0%, 100% { opacity: 1;   }
          50%       { opacity: 0.8; }
        }

        /* ── safe zone: faint inner track glow ───────────────── */
        .countdown-safe-glow {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          pointer-events: none;
          background: radial-gradient(
            circle,
            rgba(16, 217, 160, 0.07) 0%,
            transparent 72%
          );
          transition: opacity 0.4s ease;
        }
      `}</style>

      <div
        className="countdown-root"
        style={{ width: size, height: size }}
        aria-label={`${timeLeft} seconds remaining`}
        role="timer"
      >
        {/* frosted glass base */}
        <div className="countdown-backdrop" />

        {/* subtle inner teal glow (safe zone) */}
        {!isDanger && !isWarning && (
          <div className="countdown-safe-glow" />
        )}

        {/* danger outer glow */}
        {isDanger && <div className="countdown-danger-glow" />}

        <svg
          className="countdown-svg"
          width={size}
          height={size}
          viewBox="0 0 100 100"
        >
          {/* track */}
          <circle
            className="countdown-track"
            cx="50"
            cy="50"
            r={radius}
          />

          {/* progress arc */}
          <circle
            className="countdown-ring"
            cx="50"
            cy="50"
            r={radius}
            stroke={timerColor}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ filter: glowColor }}
          />

          {/* center label */}
          <text
            className={`countdown-label${isDanger ? " is-danger" : isWarning ? " is-warning" : ""}`}
            x="50"
            y="50"
            fill={timerColor}
          >
            {timeLeft}
          </text>
        </svg>
      </div>
    </>
  );
}