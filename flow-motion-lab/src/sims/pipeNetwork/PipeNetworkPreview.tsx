import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { computeNetwork } from "./pipeNetworkModel";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

// A parallel pair where pipe 2 is clearly wider, so it visibly carries more flow.
const D1 = 0.09;
const D2 = 0.2;
const RESULT = computeNetwork("parallel", D1, D2, 30, 0.02, 0.12);
const MAX_V = Math.max(RESULT.pipe1.V, RESULT.pipe2.V, 1e-6);

const particles = Array.from({ length: 56 }, () => ({
  xf: Math.random(),
  off: (Math.random() * 2 - 1) * 0.7,
  pipe: (Math.random() < RESULT.share1 ? 1 : 2) as 1 | 2,
}));

/** Looping mini view: two parallel pipes, more particles through the wider one. */
export default function PipeNetworkPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cy = height / 2;
    const spread = height * 0.26;
    const inX = width * 0.16;
    const outX = width * 0.84;
    const y1 = cy - spread;
    const y2 = cy + spread;
    const dMax = Math.max(D1, D2);
    const base = Math.max(4, Math.min(width, height) * 0.06);
    const r1 = base * (0.45 + 0.55 * (D1 / dMax));
    const r2 = base * (0.45 + 0.55 * (D2 / dMax));

    const seg = (ax: number, ay: number, bx: number, by: number, rad: number) => {
      ctx.lineCap = "round";
      ctx.lineWidth = rad * 2;
      ctx.strokeStyle = dark ? "rgba(14,116,144,0.28)" : "rgba(165,243,252,0.6)";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };

    // Shared header stubs + risers + the two parallel branches.
    seg(width * 0.04, cy, inX, cy, Math.max(r1, r2));
    seg(outX, cy, width * 0.96, cy, Math.max(r1, r2));
    seg(inX, cy, inX, y1, r1);
    seg(inX, cy, inX, y2, r2);
    seg(outX, y1, outX, cy, r1);
    seg(outX, y2, outX, cy, r2);
    seg(inX, y1, outX, y1, r1);
    seg(inX, y2, outX, y2, r2);

    for (const p of particles) {
      const vel = p.pipe === 1 ? RESULT.pipe1.V : RESULT.pipe2.V;
      p.xf += vel * 0.08 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.off = (Math.random() * 2 - 1) * 0.7;
        p.pipe = Math.random() < RESULT.share1 ? 1 : 2;
      }
      const rad = p.pipe === 1 ? r1 : r2;
      const by = p.pipe === 1 ? y1 : y2;
      const x = inX + (outX - inX) * p.xf;
      ctx.beginPath();
      ctx.arc(x, by + p.off * rad, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(vel / MAX_V, 0, 1), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
