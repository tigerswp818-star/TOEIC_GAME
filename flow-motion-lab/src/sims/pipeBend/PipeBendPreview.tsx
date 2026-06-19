import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { bendPath, type BendParticle } from "./pipeBendModel";
import { velocityColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";

const THETA = 90; // a clean 90° bend for the card
const particles: BendParticle[] = Array.from({ length: 44 }, () => ({
  s: Math.random(),
  off: (Math.random() * 2 - 1) * 0.8,
}));

/** Looping mini view of a 90° bend with flowing particles and a force arrow. */
export default function PipeBendPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width * 0.42;
    const cy = height * 0.62;
    const legLen = Math.min(width, height) * 0.4;
    const radius = Math.min(width, height) * 0.2;
    const pipeR = Math.min(width, height) * 0.1;
    const STEPS = 60;
    const center = (s: number) => bendPath(s, THETA, cx, cy, legLen, radius);

    // pipe walls
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    for (const sgn of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const pt = center(i / STEPS);
        const x = pt.x + sgn * pt.nx * pipeR;
        const y = pt.y + sgn * pt.ny * pipeR;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // particles
    for (const p of particles) {
      p.s += 1.4 * dt;
      if (p.s > 1) {
        p.s -= 1;
        p.off = (Math.random() * 2 - 1) * 0.8;
      }
      const pt = center(p.s);
      ctx.beginPath();
      ctx.arc(pt.x + pt.nx * pipeR * p.off, pt.y + pt.ny * pipeR * p.off, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.7, 0.95);
      ctx.fill();
    }

    // resultant force arrow at the bend (90° → points up-right at 45°)
    const a = center(0.5);
    const len = Math.min(width, height) * 0.3;
    drawArrow(ctx, a.x, a.y, a.x + len * 0.7, a.y - len * 0.7, "#ef4444", 3.5, 9);
  };

  return <MiniPreview draw={draw} />;
}
