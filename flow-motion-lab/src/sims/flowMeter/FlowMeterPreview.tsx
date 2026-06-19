import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { areaFracAt, velocityFracAt, maxVelocityFrac } from "./flowMeterModel";
import { velocityColor } from "@/lib/colors";

const BETA = 0.45;
const V = 4;
const particles = Array.from({ length: 60 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.8,
}));

/** Looping mini view of a venturi meter with two manometer columns. */
export default function FlowMeterPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const centerY = height * 0.62;
    const maxHalf = height * 0.24;
    const halfAt = (xf: number) => maxHalf * areaFracAt(xf, "venturi", BETA);
    const maxVel = maxVelocityFrac("venturi", BETA);

    // venturi walls
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xf = i / 60;
        const y = centerY + sgn * halfAt(xf);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
      }
      ctx.stroke();
    }

    // two manometer columns (upstream tall, throat short)
    const pipeTop = centerY - maxHalf;
    const colMax = pipeTop - 6;
    const tubeW = Math.max(8, width * 0.05);
    const tubes = [
      { x: 0.28, drop: 0.0 },
      { x: 0.58, drop: 0.55 },
    ];
    for (const tube of tubes) {
      const x = tube.x * width;
      const colPx = colMax * (1 - tube.drop);
      ctx.fillStyle = dark ? "rgba(56,189,248,0.7)" : "rgba(14,165,233,0.7)";
      ctx.fillRect(x - tubeW / 2, pipeTop - colPx, tubeW, colPx);
      ctx.strokeStyle = dark ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - tubeW / 2, 2, tubeW, pipeTop - 2);
    }

    // flowing particles
    for (const p of particles) {
      const velFrac = velocityFracAt(p.xf, "venturi", BETA);
      p.xf += velFrac * V * 0.05 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.8;
      }
      const frac = p.f * areaFracAt(p.xf, "venturi", BETA);
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + frac * maxHalf, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, velFrac / maxVel), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
