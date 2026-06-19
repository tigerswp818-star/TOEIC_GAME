import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

/** Fixed supersonic Mach number for the card (M = 2 → μ = 30°, a clear cone). */
const M = 2;
const VISUAL_SOUND_PX = 70;
const EMIT_INTERVAL = 0.14;

interface Wave {
  x: number;
  age: number;
}
// Persisted state for the looping card.
const state: { objX: number; waves: Wave[]; sinceEmit: number } = {
  objX: 0,
  waves: [],
  sinceEmit: EMIT_INTERVAL,
};

/** Looping mini view: a jet flying supersonic with an expanding Mach cone. */
export default function MachPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cy = height / 2;
    const objSpeedPx = VISUAL_SOUND_PX * M;

    state.objX += objSpeedPx * dt;
    state.sinceEmit += dt;
    while (state.sinceEmit >= EMIT_INTERVAL) {
      state.sinceEmit -= EMIT_INTERVAL;
      state.waves.push({ x: state.objX, age: 0 });
      if (state.waves.length > 40) state.waves.shift();
    }
    for (const w of state.waves) w.age += dt;
    if (state.objX > width * 0.95) {
      state.objX = width * 0.05;
      state.waves = [];
      state.sinceEmit = EMIT_INTERVAL;
    }

    const objX = state.objX;
    const muRad = Math.asin(1 / M);

    // Wavefronts.
    for (const w of state.waves) {
      const r = w.age * VISUAL_SOUND_PX;
      if (r < 0.5 || r > width * 1.5) continue;
      ctx.beginPath();
      ctx.arc(w.x, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = dark ? "rgba(103,232,249,0.5)" : "rgba(8,145,178,0.5)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Mach cone (opens backward from the nose).
    const reach = width * 1.3;
    ctx.strokeStyle = dark ? "rgba(251,113,133,0.9)" : "rgba(225,29,72,0.85)";
    ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(objX, cy);
      ctx.lineTo(objX - reach * Math.cos(muRad), cy + sgn * reach * Math.sin(muRad));
      ctx.stroke();
    }

    // The jet.
    const R = Math.max(5, Math.min(width, height) * 0.05);
    ctx.save();
    ctx.translate(objX, cy);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.beginPath();
    ctx.moveTo(R * 1.6, 0);
    ctx.lineTo(-R, -R * 0.8);
    ctx.lineTo(-R * 0.4, 0);
    ctx.lineTo(-R, R * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  return <MiniPreview draw={draw} />;
}
