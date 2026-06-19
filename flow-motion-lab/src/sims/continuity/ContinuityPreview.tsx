import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { areaAt, velocityAt } from "./continuityModel";
import { velocityColor } from "@/lib/colors";

const A1 = 0.3;
const A2 = 0.09;
const V1 = 1.6;
const particles = Array.from({ length: 60 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.85,
}));

/** Looping mini view of the wide→narrow pipe for the dashboard card. */
export default function ContinuityPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const centerY = height / 2;
    const maxHalf = height * 0.42;
    const halfAt = (xf: number) => maxHalf * (areaAt(xf, A1, A2) / A1);
    const dark = theme === "dark";
    const maxVel = velocityAt(0.5, A1, A2, V1);

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

    for (const p of particles) {
      const vel = velocityAt(p.xf, A1, A2, V1);
      p.xf += vel * 0.12 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.85;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + p.f * halfAt(p.xf), 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, vel / maxVel), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
