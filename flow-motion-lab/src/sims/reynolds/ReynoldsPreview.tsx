import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { streamlineWave } from "./reynoldsModel";

const LANES = 5;
const STEPS = 48;
const particles = Array.from({ length: 36 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.78,
  seed: Math.random() * Math.PI * 2,
}));
let phase = 0;

/**
 * Compact preview: streamlines are smooth on the left and grow wavy/chaotic
 * toward the right, with a few particles flowing through. The turbulence ramps
 * up with x so the laminar→turbulent story is visible at a glance.
 */
export default function ReynoldsPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const centerY = height / 2;
    const halfH = height * 0.4;

    phase += dt * 3.2;

    // Turbulence grows from 0 (left) to ~1 (right).
    const turbAt = (xf: number) => Math.max(0, (xf - 0.35) / 0.65);

    const color = (xf: number, alpha: number) => {
      const c = Math.min(1, turbAt(xf));
      const r = Math.round((dark ? 103 : 8) + (244 - (dark ? 103 : 8)) * c);
      const g = Math.round((dark ? 232 : 145) + (63 - (dark ? 232 : 145)) * c);
      const b = Math.round((dark ? 249 : 178) + (94 - (dark ? 249 : 178)) * c);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // streamlines
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < LANES; i++) {
      const f = -0.7 + (i / (LANES - 1)) * 1.4;
      const lane = i * 1.3;
      ctx.beginPath();
      for (let s = 0; s <= STEPS; s++) {
        const xf = s / STEPS;
        const disp = streamlineWave(xf, turbAt(xf), phase, lane);
        const x = xf * width;
        const y = centerY + (f + disp) * halfH;
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color(0.85, 0.45);
      ctx.stroke();
    }

    // particles
    for (const p of particles) {
      p.xf += 0.16 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.78;
        p.seed = Math.random() * Math.PI * 2;
      }
      const t = turbAt(p.xf);
      const wave = streamlineWave(p.xf, t, phase, p.f * 4 + 2);
      const jitter = t * 0.12 * Math.sin(phase * 3 + p.seed * 5);
      const y = centerY + (p.f + wave + jitter) * halfH;
      ctx.beginPath();
      ctx.arc(p.xf * width, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = color(p.xf, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
