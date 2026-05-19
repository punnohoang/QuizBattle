"use client";

import type { OptionResponse } from "@/lib/types";

interface AnswerOptionsProps {
  options: OptionResponse[];
  selectedOption: number | null;
  phase: "question" | "answer_reveal";
  onSelect: (optionId: number) => void;
}

const OPTION_COLORS: Array<{ rgb: string }> = [
  { rgb: "59,130,246" }, // blue
  { rgb: "16,185,129" }, // emerald
  { rgb: "245,158,11" }, // amber
  { rgb: "239,68,68" }, // red
  { rgb: "139,92,246" }, // violet
  { rgb: "6,182,212" }, // cyan
];

const LABELS = ["A", "B", "C", "D", "E", "F"];

/**
 * Adaptive grid per option count:
 *  2 → 1 col  (tall cards)
 *  3 → 3 cols, 1 row
 *  4 → 2×2
 *  5 → 3 top / 2 bottom (centered via named areas)
 *  6 → 3×2
 */
function getGridStyle(count: number): React.CSSProperties {
  switch (count) {
    case 2:
      return { gridTemplateColumns: "1fr" };
    case 3:
      return { gridTemplateColumns: "repeat(3, 1fr)" };
    case 4:
      return { gridTemplateColumns: "repeat(2, 1fr)" };
    case 5:
      return {
        gridTemplateColumns: "repeat(6, 1fr)",
        gridTemplateAreas:
          '"opt0 opt0 opt1 opt1 opt2 opt2"' +
          '" .   opt3 opt3 opt4 opt4  .  "',
      };
    case 6:
      return { gridTemplateColumns: "repeat(3, 1fr)" };
    default:
      return { gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };
  }
}

// On mobile we always stack to 1 column (2 cols for 4-option)
// Done via CSS media query in the <style> block below

function getItemStyle(count: number, index: number): React.CSSProperties {
  if (count === 5) return { gridArea: `opt${index}` };
  return {};
}

export function AnswerOptions({
  options,
  selectedOption,
  phase,
  onSelect,
}: AnswerOptionsProps) {
  const count = options.length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');

        .ao-grid {
          width: 100%;
          max-width: 880px;
          display: grid;
          gap: 12px;
          font-family: 'Sora', system-ui, sans-serif;
        }

        /* base button */
        .ao-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          min-height: 64px;
          border-radius: 16px;
          border: 2px solid transparent;
          background: none;
          cursor: pointer;
          text-align: left;
          outline: none;
          overflow: hidden;
          transition:
            transform  180ms cubic-bezier(.34,1.56,.64,1),
            opacity    300ms ease,
            border     220ms ease,
            box-shadow 220ms ease;
          animation: ao-in 320ms cubic-bezier(.22,1,.36,1) both;
        }
        .ao-btn:nth-child(1){animation-delay: 40ms}
        .ao-btn:nth-child(2){animation-delay: 90ms}
        .ao-btn:nth-child(3){animation-delay:140ms}
        .ao-btn:nth-child(4){animation-delay:190ms}
        .ao-btn:nth-child(5){animation-delay:240ms}
        .ao-btn:nth-child(6){animation-delay:290ms}

        @keyframes ao-in {
          from { opacity:0; transform:translateY(14px) scale(.96) }
          to   { opacity:1; transform:translateY(0)    scale(1)   }
        }

        /* frosted glass */
        .ao-btn::before {
          content:'';
          position:absolute; inset:0;
          border-radius:inherit;
          background: linear-gradient(135deg,
            rgba(var(--ao-rgb),.22) 0%,
            rgba(var(--ao-rgb),.10) 100%);
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          border:1px solid rgba(var(--ao-rgb),.25);
          transition: background 220ms ease;
          z-index:0;
        }
        /* top shine */
        .ao-btn::after {
          content:'';
          position:absolute;
          top:0; left:12px; right:12px; height:1px;
          background:rgba(255,255,255,.18);
          z-index:0;
        }

        /* hover */
        .ao-btn.ao-hoverable:hover {
          transform:translateY(-2px) scale(1.015);
          box-shadow:0 8px 28px rgba(var(--ao-rgb),.35);
        }
        .ao-btn.ao-hoverable:hover::before {
          background:linear-gradient(135deg,
            rgba(var(--ao-rgb),.35) 0%,
            rgba(var(--ao-rgb),.18) 100%);
        }
        .ao-btn.ao-hoverable:active { transform:scale(.97) }

        /* selected */
        .ao-btn.ao-selected {
          border-color:rgba(var(--ao-rgb),.9);
          box-shadow:
            0 0 0 4px rgba(var(--ao-rgb),.18),
            0 6px 24px rgba(var(--ao-rgb),.30);
          transform:scale(.98);
        }
        .ao-btn.ao-selected::before {
          background:linear-gradient(135deg,
            rgba(var(--ao-rgb),.40) 0%,
            rgba(var(--ao-rgb),.22) 100%);
        }

        /* correct */
        .ao-btn.ao-correct {
          border-color:#10d9a0;
          box-shadow:
            0 0 0 4px rgba(16,217,160,.20),
            0 6px 28px rgba(16,217,160,.25);
          animation:ao-pop 420ms cubic-bezier(.34,1.56,.64,1) both;
        }
        @keyframes ao-pop {
          0%  { transform:scale(.97) }
          60% { transform:scale(1.04) }
          100%{ transform:scale(1)   }
        }

        /* wrong */
        .ao-btn.ao-wrong {
          border-color:#f43f5e;
          box-shadow:0 0 0 4px rgba(244,63,94,.18);
          animation:ao-shake 380ms cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes ao-shake {
          10%,90%      { transform:translateX(-2px) }
          20%,80%      { transform:translateX(4px)  }
          30%,50%,70%  { transform:translateX(-4px) }
          40%,60%      { transform:translateX(4px)  }
          100%         { transform:translateX(0)    }
        }

        /* faded */
        .ao-btn.ao-faded { opacity:.35; pointer-events:none }
        .ao-btn:disabled  { pointer-events:none }

        /* count=2: taller, larger text */
        .ao-grid.ao-c2 .ao-btn { min-height:80px; padding:18px 20px }
        .ao-grid.ao-c2 .ao-text { font-size:clamp(.92rem,2vw,1.05rem) }

        /* badge */
        .ao-badge {
          position:relative; z-index:1;
          flex-shrink:0;
          width:36px; height:36px;
          border-radius:10px;
          background:rgba(var(--ao-rgb),.28);
          border:1.5px solid rgba(var(--ao-rgb),.45);
          display:flex; align-items:center; justify-content:center;
          font-size:.88rem; font-weight:700; color:#fff;
          transition:background 220ms ease;
        }
        .ao-btn.ao-correct .ao-badge {
          background:rgba(16,217,160,.30);
          border-color:#10d9a0; color:#10d9a0; font-size:1.05rem;
        }
        .ao-btn.ao-wrong .ao-badge {
          background:rgba(244,63,94,.28);
          border-color:#f43f5e; color:#f43f5e; font-size:1.05rem;
        }

        /* text */
        .ao-text {
          position:relative; z-index:1; flex:1;
          font-size:clamp(.82rem,1.8vw,.95rem);
          font-weight:500; line-height:1.55;
          color:rgba(255,255,255,.92);
          transition:color 220ms ease;
        }
        .ao-btn.ao-wrong .ao-text { color:rgba(255,255,255,.65) }

        /* ── Mobile overrides ── */
        @media (max-width: 600px) {
          /* Force single-column on very small screens regardless of count */
          .ao-grid { grid-template-columns: 1fr !important; grid-template-areas: none !important; }
          /* Bigger touch targets */
          .ao-btn { min-height: 58px; padding: 12px 14px; gap: 12px; }
          .ao-badge { width: 32px; height: 32px; font-size: .8rem; }
          .ao-text  { font-size: clamp(.85rem,3.5vw,1rem); }
          .ao-grid.ao-c2 .ao-btn { min-height: 68px; }
          /* Remove entry animation delay on mobile for snappier feel */
          .ao-btn { animation-delay: 0ms !important; }
        }
        @media (min-width: 601px) and (max-width: 768px) {
          /* 2-col grid on tablet for 4+ options */
          .ao-grid:not(.ao-c2):not(.ao-c3) { grid-template-columns: repeat(2, 1fr) !important; grid-template-areas: none !important; }
          .ao-btn { min-height: 62px; }
        }
      `}</style>

      <div
        className={`ao-grid ao-c${count}`}
        style={getGridStyle(count)}
      >
        {options.map((opt, i) => {
          const color = OPTION_COLORS[i % OPTION_COLORS.length];
          const isSelected = selectedOption === opt.id;
          const isCorrect = phase === "answer_reveal" && opt.is_correct;
          const isWrong = phase === "answer_reveal" && isSelected && !opt.is_correct;
          const isFaded = phase === "answer_reveal" && !isCorrect && !isSelected;
          const canHover = phase === "question" && !selectedOption;

          const cls = [
            "ao-btn",
            canHover && "ao-hoverable",
            isSelected && phase === "question" && "ao-selected",
            isCorrect && "ao-correct",
            isWrong && "ao-wrong",
            isFaded && "ao-faded",
          ].filter(Boolean).join(" ");

          return (
            <button
              key={opt.id}
              className={cls}
              style={{
                "--ao-rgb": color.rgb,
                ...getItemStyle(count, i),
              } as React.CSSProperties}
              onClick={() => {
                if (phase === "question" && !isSelected) onSelect(opt.id);
              }}
              disabled={phase !== "question" || selectedOption !== null}
              aria-pressed={isSelected}
            >
              <span className="ao-badge">
                {isCorrect ? "✓" : isWrong ? "✗" : LABELS[i] ?? i + 1}
              </span>
              <span className="ao-text">{opt.content}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}