import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { pressureColor } from "@/lib/colors";
import { approach, clamp } from "@/lib/math";
import { drawArrow, roundRect } from "@/lib/render/draw";

// Fixed preview geometry: small piston (left) lifts a heavy block on the large
// piston (right). Area ratio ~5×, so the large piston rises only 1/5 as far.
const RATIO = 5; // A2/A1 — large rises d2 = d1/RATIO
const F1_COLOR = "#f43f5e";
const F2_COLOR = "#06b6d4";

// Eased pump state kept in module scope so the preview loops smoothly.
const pump = { push: 0 };

/** Looping mini view of the two pistons for the dashboard card. */
export default function PascalPreview() {
  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";

    // Cyclic pumping stroke via time, eased by dt (freezes on pause).
    const target = 0.5 - 0.5 * Math.cos(time * 1.4);
    pump.push = approach(pump.push, target, Math.min(1, dt * 6));
    const push = pump.push;

    const smallX = width * 0.28;
    const largeX = width * 0.7;
    const topY = height * 0.2;
    const baseTop = height * 0.74;
    const baseBot = height * 0.88;
    const colSpan = baseTop - topY;

    const smallHalf = width * 0.05;
    const largeHalf = width * 0.13;

    const d1 = colSpan * 0.34 * push;
    const d2 = d1 / RATIO;
    const smallFaceY = topY + colSpan * 0.18 + d1; // moves down
    const largeFaceY = topY + colSpan * 0.5 - d2; // moves up

    // --- shared fluid body (uniform equal-pressure colour) ---
    const pNorm = clamp(0.45 + push * 0.25, 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(smallX - smallHalf, smallFaceY, smallHalf * 2, baseBot - smallFaceY);
    ctx.rect(largeX - largeHalf, largeFaceY, largeHalf * 2, baseBot - largeFaceY);
    ctx.rect(smallX - smallHalf, baseTop, largeX - smallX + largeHalf + smallHalf, baseBot - baseTop);
    ctx.clip();
    ctx.fillStyle = pressureColor(pNorm, dark ? 0.8 : 0.9);
    ctx.fillRect(0, topY, width, baseBot - topY);
    ctx.restore();

    // --- cylinder walls ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    for (const [cx, half] of [
      [smallX, smallHalf],
      [largeX, largeHalf],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx - half, topY);
      ctx.lineTo(cx - half, baseBot);
      ctx.moveTo(cx + half, topY);
      ctx.lineTo(cx + half, baseBot);
      ctx.stroke();
    }

    // --- pistons ---
    const pistonH = 7;
    ctx.fillStyle = dark ? "rgba(148,163,184,0.95)" : "rgba(100,116,139,0.95)";
    roundRect(ctx, smallX - smallHalf, smallFaceY - pistonH, smallHalf * 2, pistonH, 3);
    ctx.fill();
    roundRect(ctx, largeX - largeHalf, largeFaceY - pistonH, largeHalf * 2, pistonH, 3);
    ctx.fill();

    // --- heavy load on the large piston ---
    const loadW = largeHalf * 1.5;
    const loadH = colSpan * 0.26;
    const loadY = largeFaceY - pistonH - loadH;
    ctx.fillStyle = dark ? "rgba(217,119,6,0.92)" : "rgba(180,83,9,0.92)";
    roundRect(ctx, largeX - loadW / 2, loadY, loadW, loadH, 4);
    ctx.fill();

    // --- force arrows: F1 down (small), F2 up (large) ---
    const f1Len = colSpan * 0.22;
    const f2Len = colSpan * 0.34;
    drawArrow(ctx, smallX, smallFaceY - pistonH - f1Len, smallX, smallFaceY - pistonH, F1_COLOR, 2.5, 7);
    drawArrow(ctx, largeX, loadY, largeX, loadY - f2Len, F2_COLOR, 2.5, 7);
  };

  return <MiniPreview draw={draw} />;
}
