import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityAt, maxSpeed, seedParticles, recycleParticle, type FieldParams } from "./velocityFieldModel";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";
import { drawArrow } from "@/lib/render/draw";

const WORLD_HALF = 4;
const KIND = "vortex" as const;
const PARAMS: FieldParams = { strength: 6, secondary: 0 };
const FIELD_SPEED = 22;

const particles = seedParticles(48, WORLD_HALF);

/** Looping mini view of a vortex velocity field for the dashboard card. */
export default function VelocityFieldPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width / 2;
    const cy = height / 2;
    const pxPerWorld = Math.min(width, height) / (2 * WORLD_HALF);
    const toX = (x: number) => cx + x * pxPerWorld;
    const toY = (y: number) => cy - y * pxPerWorld;
    const refSpeed = Math.max(maxSpeed(KIND, PARAMS), 0.4);

    // sparse velocity arrows (length ∝ speed)
    const gx = 6;
    const gy = 4;
    for (let i = 0; i < gx; i++) {
      for (let j = 0; j < gy; j++) {
        const x = -WORLD_HALF + ((i + 0.5) / gx) * 2 * WORLD_HALF;
        const y = -WORLD_HALF + ((j + 0.5) / gy) * 2 * WORLD_HALF;
        const v = velocityAt(x, y, KIND, PARAMS);
        if (v.speed < 1e-4) continue;
        const len = clamp((v.speed / refSpeed) * 12, 3, 16);
        const inv = len / v.speed;
        drawArrow(
          ctx,
          toX(x),
          toY(y),
          toX(x) + v.vx * inv,
          toY(y) - v.vy * inv,
          dark ? "rgba(245,158,11,0.7)" : "rgba(217,119,6,0.7)",
          1.2,
          4,
        );
      }
    }

    // advected particles
    for (const p of particles) {
      const v = velocityAt(p.x, p.y, KIND, PARAMS);
      p.x += (v.vx * FIELD_SPEED * dt) / pxPerWorld;
      p.y += (v.vy * FIELD_SPEED * dt) / pxPerWorld;
      recycleParticle(p, WORLD_HALF, KIND);
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(v.speed / refSpeed, 0, 1), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
