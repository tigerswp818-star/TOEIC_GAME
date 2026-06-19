import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityAt, spinRate, type FieldParams, type PaddleWheel } from "./rotationalModel";
import { velocityColor } from "@/lib/colors";
import { clamp } from "@/lib/math";

const WORLD_HALF = 4;
// A shear field gives translation + visible self-spin → eye-catching preview.
const FIELD_PARAMS: FieldParams = { strength: 1.5, gradient: 1.6 };
const FIELD_SPEED = 22;

// A small grid of paddle wheels spread across the world box.
const wheels: PaddleWheel[] = Array.from({ length: 18 }, (_, i) => {
  const cols = 6;
  const col = i % cols;
  const row = Math.floor(i / cols);
  return {
    x: -WORLD_HALF + ((col + 0.5) / cols) * 2 * WORLD_HALF,
    y: -WORLD_HALF + ((row + 0.5) / 3) * 2 * WORLD_HALF,
    angle: Math.random() * Math.PI,
  };
});

/** Looping mini view: paddle wheels drifting + spinning in a shear field. */
export default function RotationalPreview() {
  const draw = ({ ctx, width, height, dt }: DrawContext) => {
    const cx = width / 2;
    const cy = height / 2;
    const pxPerWorld = Math.min(width, height) / (2 * WORLD_HALF);
    const toX = (x: number) => cx + x * pxPerWorld;
    const toY = (y: number) => cy - y * pxPerWorld;
    const vRef = velocityAt(WORLD_HALF, WORLD_HALF, "shear", FIELD_PARAMS);
    const refSpeed = Math.max(Math.hypot(vRef.vx, vRef.vy), 0.4);
    const wheelPx = pxPerWorld * 0.4;

    for (const w of wheels) {
      const v = velocityAt(w.x, w.y, "shear", FIELD_PARAMS);
      w.x += (v.vx * FIELD_SPEED * dt) / pxPerWorld;
      w.angle -= spinRate(w.x, w.y, "shear", FIELD_PARAMS) * dt;
      // wrap horizontally so it loops forever
      if (w.x > WORLD_HALF * 1.1) w.x = -WORLD_HALF * 1.1;
      if (w.x < -WORLD_HALF * 1.1) w.x = WORLD_HALF * 1.1;

      const speed = Math.hypot(v.vx, v.vy);
      const color = velocityColor(clamp(speed / refSpeed, 0, 1), 0.95);
      ctx.save();
      ctx.translate(toX(w.x), toY(w.y));
      ctx.rotate(w.angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * wheelPx, Math.sin(a) * wheelPx);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, wheelPx * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  };

  return <MiniPreview draw={draw} />;
}
