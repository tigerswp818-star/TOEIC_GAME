import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor } from "@/lib/colors";
import { drawArrow, roundRect } from "@/lib/render/draw";

const FB_COLOR = "#06b6d4";
const W_COLOR = "#f43f5e";
const SURFACE_F = 0.42; // water surface as a fraction of preview height

/** Compact looping view: a box bobbing at the water surface with force arrows. */
export default function BuoyancyPreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const surfaceY = SURFACE_F * height;

    // depth-shaded water
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfaceY + f0 * (height - surfaceY);
      const y1 = surfaceY + f1 * (height - surfaceY);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(0, y0, width, y1 - y0 + 1);
    }

    // gentle wavy surface line
    ctx.beginPath();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    for (let i = 0; i <= 40; i++) {
      const xf = i / 40;
      const y = surfaceY + Math.sin(time * 1.6 + xf * 10) * 1.6;
      i === 0 ? ctx.moveTo(xf * width, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();

    // a light box bobbing gently around the surface
    const bob = Math.sin(time * 1.4) * height * 0.05;
    const cx = width / 2;
    const half = height * 0.14;
    const cy = surfaceY - half * 0.2 + bob;
    const bw = width * 0.3;
    roundRect(ctx, cx - bw / 2, cy - half, bw, half * 2, 6);
    ctx.fillStyle = dark ? "rgba(251,191,36,0.92)" : "rgba(245,158,11,0.92)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(15,23,42,0.45)";
    ctx.stroke();

    // up/down force arrows (Fb bigger → it floats)
    const up = height * 0.2;
    drawArrow(ctx, cx - 9, cy, cx - 9, cy - up, FB_COLOR, 2.4, 7);
    drawArrow(ctx, cx + 9, cy, cx + 9, cy + up * 0.7, W_COLOR, 2.4, 7);
  };

  return <MiniPreview draw={draw} />;
}
