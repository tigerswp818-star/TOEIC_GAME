import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { seedShearParticles, layerVelocity } from "./nonNewtonianModel";
import { velocityColor } from "@/lib/colors";

const LAYERS = 7;
const PER_LAYER = 12;
const GAMMA = 40;
const particles = seedShearParticles(LAYERS, PER_LAYER);
const topVel = layerVelocity(1, GAMMA);

/**
 * Looping mini view of a shear cell: bottom plate fixed, top plate moving right,
 * fluid drawn as horizontal particle layers whose speed grows linearly with
 * height (linear Couette velocity profile u(y) = γ̇·y).
 */
export default function NonNewtonianPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const margin = 8;
    const cellX = margin;
    const cellW = width - margin * 2;
    const top = height * 0.18;
    const bottom = height * 0.82;
    const cellH = bottom - top;
    const plateH = 7;

    // plates
    ctx.fillStyle = dark ? "#334155" : "#64748b";
    ctx.fillRect(cellX - 2, bottom, cellW + 4, plateH);
    ctx.fillStyle = "#475569";
    ctx.fillRect(cellX - 2, top - plateH, cellW + 4, plateH);

    // dashed linear velocity-profile guide
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.45)" : "rgba(71,85,105,0.45)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cellX + 3, bottom);
    ctx.lineTo(cellX + 3 + cellW * 0.32, top);
    ctx.stroke();
    ctx.restore();

    const r = Math.max(1.8, cellH / (LAYERS * 3));
    for (const p of particles) {
      const u = layerVelocity(p.yf, GAMMA) / topVel;
      p.xf += u * 0.32 * dt;
      if (p.xf > 1) p.xf -= 1;
      const x = cellX + p.xf * cellW;
      const y = bottom - p.yf * cellH;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(u, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}

