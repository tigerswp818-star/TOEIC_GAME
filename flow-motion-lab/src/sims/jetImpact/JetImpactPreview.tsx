import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";
import { drawArrow } from "@/lib/render/draw";

const IMPACT_X = 0.66;
const V = 18;
const particles = Array.from({ length: 50 }, () => ({
  xf: Math.random(),
  off: Math.random() * 2 - 1,
  lane: Math.random() < 0.5 ? 1 : -1,
}));

/** Looping mini view of a jet striking a plate & splitting, for the dashboard. */
export default function JetImpactPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cy = height / 2;
    const nozzleX = width * 0.05;
    const impactX = width * IMPACT_X;
    const jetHalf = height * 0.14;
    const plateHalf = height * 0.34;

    // nozzle
    ctx.fillStyle = dark ? "#1e3a5f" : "#64748b";
    ctx.fillRect(0, cy - jetHalf - 3, nozzleX, jetHalf * 2 + 6);

    // plate
    ctx.fillStyle = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.92)";
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 4;
    ctx.fillRect(impactX - 3, cy - plateHalf, 6, plateHalf * 2);
    ctx.strokeRect(impactX - 3, cy - plateHalf, 6, plateHalf * 2);

    for (const p of particles) {
      p.xf += V * 0.02 * dt;
      if (p.xf > 1.05) {
        p.xf = nozzleX / width;
        p.off = Math.random() * 2 - 1;
        p.lane = Math.random() < 0.5 ? 1 : -1;
      }
      const atImpact = p.xf >= IMPACT_X;
      let x: number;
      let y: number;
      if (!atImpact) {
        x = nozzleX + (p.xf - nozzleX / width) / (IMPACT_X - nozzleX / width) * (impactX - nozzleX);
        y = cy + p.off * jetHalf;
      } else {
        const after = Math.min(1, (p.xf - IMPACT_X) / (1.05 - IMPACT_X));
        x = impactX + p.off * 3;
        y = cy + (p.off >= 0 ? 1 : -1) * after * plateHalf;
      }
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(atImpact ? 0.3 : 0.7, 0.95);
      ctx.fill();
    }

    // impact force arrow
    drawArrow(ctx, impactX, cy, impactX + width * 0.18, cy, "#f43f5e", 3, 9);
  };

  return <MiniPreview draw={draw} />;
}
