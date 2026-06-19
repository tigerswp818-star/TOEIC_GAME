import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";
import { drawStreamline, type Pt } from "@/lib/render/draw";

const PUMP_XF = 0.28;
const particles = Array.from({ length: 40 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.8,
}));

/** Looping mini view: a pipe with the EGL (solid) stepping UP at a pump and
 *  sloping DOWN along friction, with the HGL (dashed) trailing below it. */
export default function EglHglPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const pipeY = height * 0.74;
    const halfH = height * 0.13;
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

    // pump glyph (a circle with a + on the pipe)
    const px = PUMP_XF * width;
    ctx.strokeStyle = dark ? "#86efac" : "#16a34a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, pipeY, halfH * 0.9, 0, Math.PI * 2);
    ctx.moveTo(px - 4, pipeY);
    ctx.lineTo(px + 4, pipeY);
    ctx.moveTo(px, pipeY - 4);
    ctx.lineTo(px, pipeY + 4);
    ctx.stroke();

    // EGL: gentle slope down with a step UP at the pump
    const refY = height * 0.34;
    const slope = height * 0.12; // gradual friction drop across the length
    const step = height * 0.2; // step up at the pump
    const egl: Pt[] = [
      { x: 0, y: refY },
      { x: px, y: refY + slope * PUMP_XF },
      { x: px, y: refY + slope * PUMP_XF - step },
      { x: width, y: refY + slope - step },
    ];
    drawStreamline(ctx, egl, dark ? "#f59e0b" : "#d97706", 2.2);

    // HGL: same shape, offset below by a constant velocity head
    const gap = height * 0.09;
    const hgl: Pt[] = egl.map((p) => ({ x: p.x, y: p.y + gap }));
    drawStreamline(ctx, hgl, dark ? "#67e8f9" : "#0891b2", 1.8, [5, 4]);

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
