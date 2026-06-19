import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor } from "@/lib/colors";

/** Looping mini view of a thin capillary tube drawing water up out of a reservoir. */
export default function CapillaryPreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const surfacePx = height * 0.62;
    const bottomPx = height * 0.96;
    const resLeft = width * 0.05;
    const resRight = width * 0.95;
    const resW = resRight - resLeft;

    // reservoir water (depth-shaded)
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * (bottomPx - surfacePx);
      const y1 = surfacePx + f1 * (bottomPx - surfacePx);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(resLeft, y0, resW, y1 - y0 + 1);
    }

    // gently waving surface line
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    for (let i = 0; i <= 40; i++) {
      const xf = i / 40;
      const x = resLeft + xf * resW;
      const y = surfacePx + Math.sin(time * 1.5 + xf * 9) * 1.6;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // thin tube, with water risen above the surface and a gentle bob
    const cx = width * 0.5;
    const halfW = Math.max(4, width * 0.018);
    const tubeTop = height * 0.06;
    const baseRise = surfacePx - height * 0.18;
    const colTopPx = baseRise + Math.sin(time * 1.2) * 2.5;

    // glass walls
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.9)" : "rgba(100,116,139,0.9)";
    ctx.beginPath();
    ctx.moveTo(cx - halfW, tubeTop);
    ctx.lineTo(cx - halfW, bottomPx - 2);
    ctx.moveTo(cx + halfW, tubeTop);
    ctx.lineTo(cx + halfW, bottomPx - 2);
    ctx.stroke();

    // water column inside the tube
    const grad = ctx.createLinearGradient(0, colTopPx, 0, bottomPx);
    grad.addColorStop(0, dark ? "rgba(56,189,248,0.5)" : "rgba(125,211,252,0.75)");
    grad.addColorStop(1, dark ? "rgba(12,41,84,0.7)" : "rgba(59,130,246,0.6)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - halfW + 1, colTopPx, halfW * 2 - 2, bottomPx - 2 - colTopPx);

    // concave meniscus at the top (wetting)
    ctx.beginPath();
    ctx.strokeStyle = dark ? "rgba(186,230,253,0.95)" : "rgba(37,99,235,0.85)";
    ctx.lineWidth = 1.5;
    ctx.moveTo(cx - halfW + 1, colTopPx);
    ctx.quadraticCurveTo(cx, colTopPx + Math.min(halfW * 0.8, 4), cx + halfW - 1, colTopPx);
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
