import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { filmSpeed, seedLaneParticles, RACE_FLUIDS } from "./viscosityRaceModel";

const SLOPE = 30;
const SPEED = 0.07;
// Two or three lanes (water, oil, honey) racing down a tilted ramp.
const LANES = RACE_FLUIDS;
const rows = LANES.map(() => seedLaneParticles(7));
const speeds = LANES.map((f) => filmSpeed(f.rho, f.mu, SLOPE));
const maxSpeed = Math.max(...speeds, 1e-6);

/** Looping mini view of fluids racing down an incline for the dashboard card. */
export default function ViscosityRacePreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const angle = (SLOPE * Math.PI) / 180;
    const margin = 8;
    const rampLen = width - margin * 2;
    const laneGap = (height * 0.66) / LANES.length;
    const topY = height * 0.18;

    ctx.save();
    ctx.translate(margin, height - margin);
    ctx.rotate(-angle);

    // ramp surface
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(rampLen, topY);
    ctx.stroke();

    for (let li = 0; li < LANES.length; li++) {
      const fluid = LANES[li];
      const laneY = topY - laneGap * (li + 0.5);
      const vRel = speeds[li];
      const row = rows[li];
      for (const part of row) {
        part.s += (vRel / maxSpeed) * SPEED * dt;
        if (part.s > 1) {
          part.s -= 1;
          part.j = (Math.random() * 2 - 1) * 0.5;
        }
        const x = rampLen * (1 - part.s);
        const y = laneY + part.j * laneGap * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = fluid.color;
        ctx.fill();
      }
    }

    ctx.restore();
  };

  return <MiniPreview draw={draw} />;
}
