import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityAt, insideBody } from "./flowAroundModel";
import { velocityColor } from "@/lib/colors";

const U = 2.2; // free-stream speed (m/s) for the preview
const FIELD_SPEED = 24;
// Persisted tracer state for the looping card (normalised → scaled at draw time).
const tracers = Array.from({ length: 70 }, () => ({
  xf: Math.random(),
  yf: Math.random(),
}));

/** Looping mini view of fluid streaming around a circle for the dashboard card. */
export default function FlowAroundPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width * 0.42;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.16;

    // Body.
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.9)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.stroke();

    // A faint hint of the wake region behind the body.
    ctx.fillStyle = dark ? "rgba(244,63,94,0.10)" : "rgba(244,63,94,0.08)";
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.4, cy - R * 0.8);
    ctx.lineTo(width, cy - R * 1.4);
    ctx.lineTo(width, cy + R * 1.4);
    ctx.lineTo(cx + R * 0.4, cy + R * 0.8);
    ctx.closePath();
    ctx.fill();

    // Tracers advected by the cylinder field, streaming around the body.
    for (const t of tracers) {
      let x = t.xf * width;
      let y = t.yf * height;
      const { vx, vy, speed } = velocityAt(x, y, cx, cy, R, U);
      x += vx * FIELD_SPEED * dt;
      y += vy * FIELD_SPEED * dt;

      if (insideBody(x, y, cx, cy, R)) {
        const ax = x - cx;
        const ay = y - cy;
        const d = Math.max(Math.hypot(ax, ay), 1e-3);
        x = cx + (ax / d) * (R + 1.5);
        y = cy + (ay / d) * (R + 1.5);
      }
      if (x > width || y < 0 || y > height) {
        x = 0;
        y = Math.random() * height;
      }
      t.xf = x / width;
      t.yf = y / height;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, speed / (2 * U)), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
