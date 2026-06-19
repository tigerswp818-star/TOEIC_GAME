import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { areaAt, velocityAt, pressureAt } from "./bernoulliModel";
import { velocityColor, pressureColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

const A1 = 0.3;
const A2 = 0.07;
const V1 = 2.0;
const RHO = 1000;
const particles = Array.from({ length: 56 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.85,
}));

/** Looping mini view of the venturi with a subtle pressure tint for the card. */
export default function BernoulliPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const centerY = height / 2;
    const maxHalf = height * 0.42;
    const halfAt = (xf: number) => maxHalf * (areaAt(xf, A1, A2) / A1);
    const dark = theme === "dark";
    const maxVel = velocityAt(0.5, A1, A2, V1);

    const pThroat = pressureAt(0.5, A1, A2, V1, RHO);
    const pWide = pressureAt(0, A1, A2, V1, RHO);
    const pSpan = Math.max(pWide - pThroat, 1e-6);

    // subtle pressure tint (cool in the throat)
    const strips = 48;
    for (let i = 0; i < strips; i++) {
      const xf = (i + 0.5) / strips;
      const norm = clamp((pressureAt(xf, A1, A2, V1, RHO) - pThroat) / pSpan, 0, 1);
      const x0 = (i / strips) * width;
      const x1 = ((i + 1) / strips) * width;
      ctx.fillStyle = pressureColor(norm, 0.3);
      ctx.fillRect(x0, centerY - halfAt(xf), x1 - x0 + 1, 2 * halfAt(xf));
    }

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
