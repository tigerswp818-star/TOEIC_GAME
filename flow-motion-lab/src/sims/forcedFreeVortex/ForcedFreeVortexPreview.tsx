import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { tangentialSpeed, angularSpeed, peakSpeed, type VortexParams } from "./forcedFreeVortexModel";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

const TANK = 2; // metres
// A free vortex (irrotational drain) — fast near the centre, slow at the edge.
const PARAMS: VortexParams = { omega: 2.5, circulation: 1.8 };
const VMAX = peakSpeed("free", PARAMS, TANK);

const particles = Array.from({ length: 70 }, () => ({
  rf: clamp(Math.sqrt(Math.random()) * 0.95 + 0.05, 0.05, 0.97),
  angle: Math.random() * Math.PI * 2,
}));

/** Looping top-down mini view: a free vortex with fast particles near the core. */
export default function ForcedFreeVortexPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width / 2;
    const cy = height / 2;
    const tankPx = Math.min(width, height) * 0.46;

    // faint concentric guide rings
    ctx.strokeStyle = dark ? "rgba(103,232,249,0.25)" : "rgba(8,145,178,0.25)";
    ctx.lineWidth = 1;
    for (const f of [0.3, 0.6, 0.9]) {
      ctx.beginPath();
      ctx.arc(cx, cy, f * tankPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of particles) {
      const rM = p.rf * TANK;
      p.angle += angularSpeed(rM, "free", PARAMS) * dt;
      const rPx = p.rf * tankPx;
      const x = cx + Math.cos(p.angle) * rPx;
      const y = cy + Math.sin(p.angle) * rPx;
      const speed = tangentialSpeed(rM, "free", PARAMS);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(speed / VMAX, 0, 1), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
