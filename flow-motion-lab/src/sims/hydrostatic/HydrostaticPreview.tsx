import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";

const SURFACE_Y = 0.16;
const BOTTOM_Y = 0.92;
const ARROW_COLOR = "#f59e0b";

/** Looping mini view of the depth-shaded tank with outward wall arrows. */
export default function HydrostaticPreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const surfacePx = SURFACE_Y * height;
    const bottomPx = BOTTOM_Y * height;
    const tankLeft = width * 0.16;
    const tankRight = width * 0.84;
    const tankW = tankRight - tankLeft;

    // depth-shaded water (surface light → deep dark)
    const bands = 28;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * (bottomPx - surfacePx);
      const y1 = surfacePx + f1 * (bottomPx - surfacePx);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(tankLeft, y0, tankW, y1 - y0 + 1);
    }

    // tank walls
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(tankLeft, surfacePx - height * 0.06);
    ctx.lineTo(tankLeft, bottomPx);
    ctx.lineTo(tankRight, bottomPx);
    ctx.lineTo(tankRight, surfacePx - height * 0.06);
    ctx.stroke();

    // outward wall arrows — longer near the bottom (∝ depth)
    const fracs = [0.3, 0.6, 0.9];
    const maxLen = tankW * 0.22;
    for (const df of fracs) {
      const len = Math.max(4, df * maxLen);
      const y = surfacePx + df * (bottomPx - surfacePx);
      drawArrow(ctx, tankLeft, y, tankLeft - len, y, ARROW_COLOR, 2, 6);
      drawArrow(ctx, tankRight, y, tankRight + len, y, ARROW_COLOR, 2, 6);
    }

    // probe dot partway down with a gentle bob
    const probeDepth = 0.55 + Math.sin(time * 1.1) * 0.18;
    const probeY = surfacePx + probeDepth * (bottomPx - surfacePx);
    const probeX = tankLeft + tankW * 0.5;
    ctx.beginPath();
    ctx.arc(probeX, probeY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
