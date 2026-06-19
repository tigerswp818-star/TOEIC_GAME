import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityAt, type VortexParams } from "./circulationModel";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

const KIND = "free" as const;
const PARAMS: VortexParams = { strength: 2.2 };
const LOOP_R = 0.42; // fraction of view half-extent
const REF_SPEED = 1.6; // colour normalisation reference

// Particles spread over the disc, biased for roughly uniform density by area.
const particles = Array.from({ length: 60 }, () => ({
  rf: clamp(Math.sqrt(Math.random()) * 0.92 + 0.06, 0.06, 0.95),
  angle: Math.random() * Math.PI * 2,
}));

/** Looping mini view of a vortex with a closed loop and a travelling marker. */
export default function CirculationPreview() {
  let markerAngle = 0;

  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width / 2;
    const cy = height / 2;
    const half = Math.min(width, height) * 0.46; // view half-extent in px

    // Speed at a point (px → world): world unit = 1, so r in px / half.
    const speedAt = (rfx: number, rfy: number) => {
      const v = velocityAt(rfx, rfy, KIND, PARAMS);
      return Math.hypot(v.vx, v.vy);
    };

    // faint concentric vortex streamlines
    ctx.strokeStyle = dark ? "rgba(103,232,249,0.22)" : "rgba(8,145,178,0.22)";
    ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.arc(cx, cy, f * half, 0, Math.PI * 2);
      ctx.stroke();
    }

    // orbiting particles coloured by tangential speed
    for (const p of particles) {
      const r = p.rf; // world radius (view half-extent = 1)
      const v = velocityAt(Math.cos(p.angle) * r, Math.sin(p.angle) * r, KIND, PARAMS);
      const omega = Math.hypot(v.vx, v.vy) / Math.max(r, 1e-3);
      p.angle += omega * dt;
      const rPx = p.rf * half;
      const x = cx + Math.cos(p.angle) * rPx;
      const y = cy + Math.sin(p.angle) * rPx;
      ctx.beginPath();
      ctx.arc(x, y, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(speedAt(Math.cos(p.angle) * r, Math.sin(p.angle) * r) / REF_SPEED, 0, 1), 0.95);
      ctx.fill();
    }

    // the closed loop (a circle)
    const loopPx = LOOP_R * half;
    ctx.beginPath();
    ctx.arc(cx, cy, loopPx, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // a marker travelling around the loop
    markerAngle += 1.4 * dt;
    const mx = cx + Math.cos(markerAngle) * loopPx;
    const my = cy + Math.sin(markerAngle) * loopPx;
    ctx.beginPath();
    ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();

    // centre marker
    ctx.beginPath();
    ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.fill();
  };

  return <MiniPreview draw={draw} />;
}
