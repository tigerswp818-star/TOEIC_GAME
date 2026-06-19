import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";
import {
  nozzleReaction,
  profileFrac,
  speedAt,
  NOZZLE_START,
  NOZZLE_END,
} from "./nozzleReactionModel";

const D1 = 0.15;
const D2 = 0.04;
const P1 = 200000;
const V1 = 2;
const RATIO = D2 / D1;
const RES = nozzleReaction(D1, D2, P1, V1);
const particles = Array.from({ length: 55 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.85,
}));

/** Looping mini view of a converging nozzle with an accelerating jet + reaction arrow. */
export default function NozzleReactionPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const centerY = height / 2;
    const maxHalf = height * 0.42;
    const halfAt = (xf: number) => maxHalf * profileFrac(xf, RATIO);
    const maxVel = Math.max(RES.v2, 1e-6);
    const wallEnd = NOZZLE_END;

    // nozzle walls (converging body)
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xf = (i / 60) * wallEnd;
        const y = centerY + sgn * halfAt(xf);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
      }
      ctx.stroke();
    }

    // particles accelerating through the nozzle and out as a jet
    const jetHalf = halfAt(NOZZLE_END);
    for (const p of particles) {
      const vel = speedAt(p.xf, RES.q, RES.a1, RATIO);
      p.xf += vel * 0.02 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.85;
      }
      const half = p.xf <= NOZZLE_END ? halfAt(p.xf) : jetHalf;
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + p.f * half, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, vel / maxVel), 0.95);
      ctx.fill();
    }

    // backward reaction force arrow on the nozzle body
    const anchorX = NOZZLE_START * width + (NOZZLE_END - NOZZLE_START) * width * 0.4;
    const anchorY = centerY - maxHalf * 0.7;
    drawArrow(ctx, anchorX, anchorY, anchorX - width * 0.22, anchorY, "#ef4444", 3, 9);
  };

  return <MiniPreview draw={draw} />;
}
