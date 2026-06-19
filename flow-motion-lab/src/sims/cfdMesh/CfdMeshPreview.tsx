import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { fieldVelocity, insideCylinder, maxFieldSpeed } from "./cfdMeshModel";
import { clamp } from "@/lib/math";
import { velocityColor } from "@/lib/colors";

const U = 3;
// Cycle through coarse → fine → coarse so the card visibly "refines" the mesh.
const LEVELS = [6, 10, 16, 24, 16, 10];
const SECONDS_PER_LEVEL = 1.6;

/** Looping mini view: a cylinder in a mesh that refines coarse→fine over time. */
export default function CfdMeshPreview() {
  // Drives the level cycle via accumulated dt (respects pause: dt = 0).
  const state = { time: 0 };

  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    state.time += dt;
    const dark = theme === "dark";
    const cx = width * 0.46;
    const cy = height / 2;
    const R = Math.max(6, 0.13 * Math.min(width, height));
    const vmax = Math.max(maxFieldSpeed(U), 1e-6);

    const idx = Math.floor(state.time / SECONDS_PER_LEVEL) % LEVELS.length;
    const n = LEVELS[idx];
    const cw = width / n;
    const ch = height / n;

    // shaded cells sampled from the true field
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * cw;
        const y = (j + 0.5) * ch;
        if (insideCylinder(x, y, cx, cy, R)) {
          ctx.fillStyle = dark ? "rgba(30,58,95,0.95)" : "rgba(100,116,139,0.95)";
          ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
          continue;
        }
        const { speed } = fieldVelocity(x, y, cx, cy, R, U);
        ctx.fillStyle = velocityColor(clamp(speed / vmax, 0, 1), dark ? 0.6 : 0.7);
        ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
      }
    }

    // mesh grid lines
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.3)" : "rgba(71,85,105,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      ctx.moveTo(i * cw, 0);
      ctx.lineTo(i * cw, height);
    }
    for (let j = 1; j < n; j++) {
      ctx.moveTo(0, j * ch);
      ctx.lineTo(width, j * ch);
    }
    ctx.stroke();

    // true cylinder outline on top
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
