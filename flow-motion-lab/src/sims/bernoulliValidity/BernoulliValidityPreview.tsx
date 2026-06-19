import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { clamp } from "@/lib/math";
import { drawStreamline, type Pt } from "@/lib/render/draw";

const LANES = 6;
const STEPS = 40;
const particles = Array.from({ length: 36 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.85,
  seed: Math.random() * Math.PI * 2,
}));

let phase = 0;

/**
 * Mini dashboard preview: smooth parallel streamlines slowly morph toward
 * turbulent eddies and back, illustrating "Bernoulli validity" — a representative
 * ideal→turbulent transition.
 */
export default function BernoulliValidityPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    phase += dt;
    // chaos oscillates 0 (smooth/valid) → 1 (turbulent/invalid) → 0.
    const chaos = 0.5 - 0.5 * Math.cos(phase * 0.5);

    const centerY = height / 2;
    const halfH = height * 0.4;

    const laneFrac = (i: number) => -0.8 + (i / (LANES - 1)) * 1.6;
    const wave = (xf: number, lane: number) => {
      if (chaos <= 0.001) return 0;
      const k = 4 + 7 * chaos;
      return (
        chaos *
        (0.26 * Math.sin(k * xf - phase * 3 + lane) +
          0.14 * Math.sin(2 * k * xf - phase * 4.2 + lane * 1.6))
      );
    };

    // colour blends cyan (calm) → rose (chaotic).
    const col = (alpha: number) => {
      const r = Math.round(8 + (244 - 8) * chaos);
      const g = Math.round(145 + (63 - 145) * chaos);
      const b = Math.round(178 + (94 - 178) * chaos);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    for (let i = 0; i < LANES; i++) {
      const f = laneFrac(i);
      const lane = i * 1.3;
      const pts: Pt[] = [];
      for (let s = 0; s <= STEPS; s++) {
        const xf = s / STEPS;
        pts.push({ x: xf * width, y: centerY + clamp(f + wave(xf, lane), -0.96, 0.96) * halfH });
      }
      drawStreamline(ctx, pts, col(dark ? 0.4 : 0.45), 1.3);
    }

    for (const p of particles) {
      p.xf += 0.12 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.85;
        p.seed = Math.random() * Math.PI * 2;
      }
      const jitter = chaos * 0.2 * Math.sin(phase * 4 + p.seed * 5) + wave(p.xf, p.f * 4 + 2);
      const yf = clamp(p.f + jitter, -0.95, 0.95);
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + yf * halfH, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = col(0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
