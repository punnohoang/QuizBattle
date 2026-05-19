/**
 * Sound effects using Web Audio API — no external files needed.
 * All sounds are generated procedurally.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx || audioCtx.state === "closed") {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Resume AudioContext if it was suspended by autoplay policy */
export async function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    await ctx.resume();
  }
}

function playTone(
  frequency: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  gainPeak: number,
  ctx: AudioContext,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** 🎉 Happy ascending chime — played when answer is correct */
export function playCorrectSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Ascending major arpeggio: C5 - E5 - G5 - C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone(freq, "sine", now + i * 0.08, 0.4, 0.3, ctx);
  });

  // Add a soft "shimmer" layer
  playTone(1318.5, "sine", now + 0.05, 0.5, 0.12, ctx);
}

/** ❌ Sad descending sound — played when answer is wrong */
export function playWrongSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(300, "sawtooth", now, 0.12, 0.25, ctx);
  playTone(220, "sawtooth", now + 0.1, 0.18, 0.2, ctx);
  playTone(160, "sawtooth", now + 0.2, 0.22, 0.15, ctx);
}

/** 🔔 Subtle click — when player selects an option */
export function playSelectSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(800, "sine", now, 0.08, 0.18, ctx);
  playTone(1000, "sine", now + 0.05, 0.06, 0.12, ctx);
}

/** ⏰ Tick sound for low-time warning */
export function playTickSound() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  playTone(880, "square", now, 0.05, 0.1, ctx);
}
