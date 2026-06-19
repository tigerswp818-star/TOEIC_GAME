import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import type { Pt } from "@/lib/render/draw";
import { drawArrow } from "@/lib/render/draw";
import { airfoilOutline } from "./airfoilModel";
import { velocityColor } from "@/lib/colors";

const ALPHA_DEG = 8; // a clearly lifting angle of attack
const V = 26; // flow speed for the preview
const FIELD_SPEED = 0.5;
// Persisted tracer state for the looping card (normalised → scaled at draw time).
const tracers = Array.from({ length: 56 }, () => ({
  xf: Math.random(),
  lane: Math.random() * 2 - 1, // <0 over the top, >0 underneath
}));

/** Looping mini view of an airfoil with faster top flow + a lift arrow. */
export default function AirfoilPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cx = width * 0.44;
    const cy = height / 2;
    const chord = Math.min(width, height) * 0.62;
    const aRad = (ALPHA_DEG * Math.PI) / 180;
    const rot = -aRad;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const toScreen = (lx: number, ly: number): Pt => ({
      x: cx + lx * cosR - ly * sinR,
      y: cy + lx * sinR + ly * cosR,
    });

    // Tracers streaming over / under the wing, faster on the top.
    for (const t of tracers) {
      const above = t.lane < 0;
      const x = t.xf * width;
      const dxc = (x - cx) / chord;
      const bell = Math.exp(-(dxc * dxc) * 2.2);
      const speedFactor = above
        ? 1 + bell * (0.6 + 2.2 * aRad)
        : 1 - bell * (0.15 + 0.4 * aRad);
      t.xf += (V * FIELD_SPEED * Math.max(0.1, speedFactor) * dt) / width;
      if (t.xf > 1) {
        t.xf -= 1;
        t.lane = Math.random() * 2 - 1;
      }
      const defl = bell * (above ? -1 : 0.55) * (0.5 + 1.6 * aRad) * height * 0.08;
      const y = cy + t.lane * height * 0.5 + defl;
      ctx.beginPath();
      ctx.arc(t.xf * width, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, (speedFactor - 0.5) / 2.2), 0.95);
      ctx.fill();
    }

    // Airfoil body.
    const outline = airfoilOutline(chord, 0.12);
    ctx.beginPath();
    const p0 = toScreen(outline[0].x, outline[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < outline.length; i++) {
      const sp = toScreen(outline[i].x, outline[i].y);
      ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(30,58,95,0.95)" : "rgba(100,116,139,0.92)";
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Lift arrow (up).
    drawArrow(ctx, cx, cy, cx, cy - height * 0.34, "#22c55e", 3, 9);
  };

  return <MiniPreview draw={draw} />;
}
