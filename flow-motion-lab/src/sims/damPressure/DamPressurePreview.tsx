import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";

const SURFACE_Y = 0.18;
const BOTTOM_Y = 0.9;
const ARROW_COLOR = "#38bdf8";
const RESULTANT_COLOR = "#f59e0b";

/** Looping mini view: depth-shaded water + a gate + triangular pressure arrows. */
export default function DamPressurePreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const surfacePx = SURFACE_Y * height;
    const bottomPx = BOTTOM_Y * height;
    const colH = bottomPx - surfacePx;
    const waterLeft = width * 0.1;
    const gateX = width * 0.78;

    // depth-shaded water (surface light → deep dark)
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * colH;
      const y1 = surfacePx + f1 * colH;
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(waterLeft, y0, gateX - waterLeft, y1 - y0 + 1);
    }

    // gentle surface wave
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    for (let i = 0; i <= 30; i++) {
      const xf = i / 30;
      const x = waterLeft + xf * (gateX - waterLeft);
      const y = surfacePx + Math.sin(time * 1.6 + xf * 10) * 1.6;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // the gate (thick slab on the right)
    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = dark ? "#64748b" : "#475569";
    ctx.beginPath();
    ctx.moveTo(gateX, surfacePx);
    ctx.lineTo(gateX, bottomPx);
    ctx.stroke();
    ctx.restore();

    // ground line
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(waterLeft, bottomPx);
    ctx.lineTo(gateX + width * 0.08, bottomPx);
    ctx.stroke();

    // triangular pressure arrows — longer near the bottom (∝ depth)
    const fracs = [0.25, 0.5, 0.75, 1.0];
    const maxLen = (gateX - waterLeft) * 0.5;
    for (const df of fracs) {
      const len = Math.max(3, df * maxLen);
      const y = surfacePx + df * colH;
      drawArrow(ctx, gateX - len, y, gateX, y, ARROW_COLOR, 2, 6);
    }

    // resultant force arrow at 2/3 depth (below mid-depth)
    const copY = surfacePx + (2 / 3) * colH;
    const resLen = (gateX - waterLeft) * 0.42;
    drawArrow(ctx, gateX - resLen, copY, gateX, copY, RESULTANT_COLOR, 4, 10);
    ctx.beginPath();
    ctx.arc(gateX, copY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = RESULTANT_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
