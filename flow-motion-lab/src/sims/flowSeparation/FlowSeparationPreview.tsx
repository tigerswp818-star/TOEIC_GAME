import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityAt, insideBody } from "./flowSeparationModel";
import { velocityColor } from "@/lib/colors";

const U = 2.2; // free-stream speed for the preview
const FIELD_SPEED = 24;

// Persisted tracer state for the looping card (normalised → scaled at draw time).
const tracers = Array.from({ length: 64 }, () => ({
  xf: Math.random(),
  yf: Math.random(),
  seed: Math.random() * Math.PI * 2,
}));
// Two shed vortices in the wake (upper + lower rows of a Kármán street).
const vortices = [
  { xf: 0.2, sign: 1, spin: 0 },
  { xf: 0.7, sign: -1, spin: Math.PI },
];

/** Looping mini view: a cylinder with separated flow + a couple of shed vortices. */
export default function FlowSeparationPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width * 0.32;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.18;

    // Separation point a bit before the rear (laminar-ish ~80° from front).
    const sepRad = (80 * Math.PI) / 180;
    const sepX = cx - R * Math.cos(sepRad);
    const sepDy = R * Math.sin(sepRad);

    // Body.
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.9)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.stroke();

    // Faint wake region behind the separation line.
    ctx.fillStyle = dark ? "rgba(244,63,94,0.10)" : "rgba(244,63,94,0.08)";
    ctx.beginPath();
    ctx.moveTo(sepX, cy - sepDy);
    ctx.lineTo(width, cy - R * 1.5);
    ctx.lineTo(width, cy + R * 1.5);
    ctx.lineTo(sepX, cy + sepDy);
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
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, speed / (2 * U)), 0.95);
      ctx.fill();
    }

    // A couple of rotating shed vortices drifting downstream (Kármán street).
    const startX = sepX + R * 0.4;
    const endX = width + R;
    for (const v of vortices) {
      v.xf += dt * 0.22;
      if (v.xf > 1) {
        v.xf -= 1;
        v.sign = v.sign === 1 ? -1 : 1;
      }
      v.spin += dt * v.sign * 3.2;
      const vxp = startX + v.xf * (endX - startX);
      const vyp = cy + v.sign * R * 0.7;
      const vr = R * 0.55;
      for (let b = 0; b < 6; b++) {
        const a = v.spin + (b / 6) * Math.PI * 2;
        const rr = vr * (0.4 + 0.6 * (b % 3) / 2);
        const px = vxp + Math.cos(a) * rr;
        const py = vyp + Math.sin(a) * rr;
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(0.85, 0.9);
        ctx.fill();
      }
    }

    // Separation-point dots on both sides.
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.arc(sepX, cy + s * sepDy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
