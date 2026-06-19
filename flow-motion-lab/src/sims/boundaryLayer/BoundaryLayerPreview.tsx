import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

// A self-contained, illustrative boundary-layer growth for the dashboard card.
// δ(x) grows like √x near the leading edge then a touch faster downstream, so
// the edge curve visibly thickens left→right.
const DOMAIN_H = 1; // normalised height above the plate
const edgeFrac = (xf: number) => {
  const base = 0.18 * Math.sqrt(clamp(xf, 0, 1)); // √x growth
  const turb = xf > 0.6 ? 0.45 * (xf - 0.6) : 0; // faster after "transition"
  return clamp(base + turb, 0, 0.9);
};
// u(y)/U inside the layer: 0 at the wall (no-slip), 1 at the edge.
const ratioAt = (yf: number, edge: number) => {
  if (edge <= 0) return 1;
  if (yf >= edge) return 1;
  return Math.sin((Math.PI / 2) * clamp(yf / edge, 0, 1));
};

const particles = Array.from({ length: 70 }, () => ({
  xf: Math.random(),
  yf: Math.random() * DOMAIN_H,
}));

/** Looping mini view of flow over a flat plate with a growing boundary layer. */
export default function BoundaryLayerPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const plateY = height * 0.9;
    const domainH = height * 0.82;
    const yToPx = (yf: number) => plateY - (clamp(yf, 0, DOMAIN_H) / DOMAIN_H) * domainH;

    // boundary-layer region fill under the edge curve
    ctx.beginPath();
    ctx.moveTo(0, plateY);
    for (let i = 0; i <= 60; i++) {
      const xf = i / 60;
      ctx.lineTo(xf * width, yToPx(edgeFrac(xf)));
    }
    ctx.lineTo(width, plateY);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(8,47,73,0.5)" : "rgba(8,145,178,0.16)";
    ctx.fill();

    // edge curve δ(x)
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const xf = i / 60;
      const px = xf * width;
      const py = yToPx(edgeFrac(xf));
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // particles flow with speed = u(y), lagging near the plate (no-slip)
    for (const p of particles) {
      const edge = edgeFrac(p.xf);
      const ratio = ratioAt(p.yf, edge);
      p.xf += (0.06 + 0.5 * ratio) * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.yf = Math.random() * DOMAIN_H;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, yToPx(p.yf), 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(ratio, 0.95);
      ctx.fill();
    }

    // the flat plate (bottom)
    ctx.fillStyle = dark ? "#1e3a5f" : "#64748b";
    ctx.fillRect(0, plateY, width, height - plateY);
  };

  return <MiniPreview draw={draw} />;
}
