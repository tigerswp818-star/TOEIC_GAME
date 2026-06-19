import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";

const particles = Array.from({ length: 48 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.78,
}));

/**
 * Compact dashboard preview: pipe particles flowing left→right with a small
 * dimensionless-number badge (Re) drawn on the canvas, hinting that this sim is
 * about dimensionless groups.
 */
export default function DimensionlessPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const centerY = height / 2;
    const halfH = height * 0.32;
    const top = centerY - halfH;
    const bot = centerY + halfH;

    // pipe walls
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top); ctx.lineTo(width, top);
    ctx.moveTo(0, bot); ctx.lineTo(width, bot);
    ctx.stroke();

    // flowing particles
    for (const p of particles) {
      p.xf += 0.18 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.78;
      }
      const y = centerY + p.f * halfH;
      ctx.beginPath();
      ctx.arc(p.xf * width, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.5 + 0.5 * Math.abs(p.f), 0.95);
      ctx.fill();
    }

    // number badge
    ctx.font = "bold 16px 'IBM Plex Sans Thai', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle = dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)";
    const txt = "Re = ρVD/μ";
    const tw = ctx.measureText(txt).width;
    ctx.fillRect(6, 6, tw + 12, 24);
    ctx.fillStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.fillText(txt, 12, 9);
  };

  return <MiniPreview draw={draw} />;
}
