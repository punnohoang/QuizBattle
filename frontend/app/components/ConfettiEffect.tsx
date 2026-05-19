"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle" | "star";
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#a78bfa",
];

function createParticle(canvasWidth: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 8;
  const shapes: Particle["shape"][] = ["rect", "circle", "star"];
  return {
    x: Math.random() * canvasWidth,
    y: -10,
    vx: Math.cos(angle) * speed * 0.4,
    vy: speed + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    opacity: 1,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const spikes = 5;
  const outerRadius = size;
  const innerRadius = size * 0.45;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(x, y - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.lineTo(x, y - outerRadius);
  ctx.closePath();
}

interface ConfettiEffectProps {
  active: boolean;
}

export function ConfettiEffect({ active }: ConfettiEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    activeRef.current = true;

    // Spawn 180 particles in bursts
    const totalParticles = 180;
    const burstDelay = [0, 80, 160];

    burstDelay.forEach((delay, bi) => {
      setTimeout(() => {
        if (!activeRef.current) return;
        const count = bi === 0 ? 80 : bi === 1 ? 60 : 40;
        for (let i = 0; i < count; i++) {
          // Spread from center-ish area
          const p = createParticle(canvas.width);
          if (bi === 0) {
            p.x = canvas.width * 0.5 + (Math.random() - 0.5) * 120;
            p.y = canvas.height * 0.3;
            p.vy = -(4 + Math.random() * 12);
            p.vx = (Math.random() - 0.5) * 18;
          } else {
            p.x = bi === 1
              ? canvas.width * 0.2 + Math.random() * canvas.width * 0.2
              : canvas.width * 0.6 + Math.random() * canvas.width * 0.2;
            p.y = canvas.height * 0.35;
            p.vy = -(3 + Math.random() * 10);
            p.vx = (Math.random() - 0.5) * 14;
          }
          particlesRef.current.push(p);
        }
      }, delay);
    });

    const gravity = 0.35;
    const drag = 0.995;

    const animate = () => {
      if (!activeRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Fade out when near bottom or after a while
        if (p.y > canvas.height * 0.75) {
          p.opacity -= 0.025;
        }

        if (p.opacity <= 0 || p.y > canvas.height + 40) return false;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, 0, 0, p.size / 2);
          ctx.fill();
        }

        ctx.restore();
        return true;
      });

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    // Auto-cleanup after 4s
    const cleanup = setTimeout(() => {
      activeRef.current = false;
      particlesRef.current = [];
      cancelAnimationFrame(rafRef.current);
    }, 4500);

    return () => {
      activeRef.current = false;
      clearTimeout(cleanup);
      cancelAnimationFrame(rafRef.current);
      particlesRef.current = [];
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
