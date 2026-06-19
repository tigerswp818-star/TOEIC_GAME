import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";
import { drawStreamline, type Pt } from "@/lib/render/draw";

const FITTING_XF = 0.55;
const particles = Array.from({ length: 40 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.8,
}));

/** Looping mini view: a compact pipe, flowing particles and a sloping energy
 *  line with one step at a fitting, for the dashboard card. */
export default function HeadLossPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const pipeY = height * 0.7;
    const halfH = height * 0.16;
    const top = pipeY - halfH;
    const bot = pipeY + halfH;

    // pipe walls
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    // fitting glyph (a small bump on the top wall)
    const fx = FITTING_XF * width;
    ctx.strokeStyle = dark ? "#c4b5fd" : "#7c3aed";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(fx, top, halfH * 0.5, Math.PI, 0);
    ctx.stroke();

    // energy line: fixed moderate downward slope with one step at the fitting
    const refY = height * 0.14;
    const slope = height * 0.16; // total gradual drop across the length
    const step = height * 0.14; // step drop at the fitting
    const egl: Pt[] = [
      { x: 0, y: refY },
      { x: fx, y: refY + slope * FITTING_XF },
      { x: fx, y: refY + slope * FITTING_XF + step },
      { x: width, y: refY + slope + step },
    ];
    drawStreamline(ctx, egl, dark ? "#f59e0b" : "#d97706", 2.2);

    // particles flow left→right
    for (const p of particles) {
      p.xf += 2 * 0.06 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.8;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, pipeY + p.f * halfH, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.55, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
