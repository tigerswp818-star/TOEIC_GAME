import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { computeJump, JUMP_XF, ROLLER_HALF } from "./hydraulicJumpModel";
import { depthColor, velocityColor } from "@/lib/colors";
import { clamp, smoothstep } from "@/lib/math";

const Y1 = 0.25;
const V1 = 6.5;
const RES = computeJump(Y1, V1);

const particles = Array.from({ length: 60 }, () => ({
  xf: Math.random(),
  f: Math.random() * 2 - 1,
  seed: Math.random() * Math.PI * 2,
}));

let phase = 0;

/** Looping mini view: shallow-fast → turbulent roller → deep-slow. */
export default function HydraulicJumpPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const bedY = height * 0.92;
    const ceil = height * 0.12;
    const maxDepth = Math.max(RES.y2, Y1, 1e-6);
    const pxPerM = (bedY - ceil) / maxDepth;
    const surfaceY = (d: number) => bedY - d * pxPerM;

    const turb = clamp((RES.fr1 - 1) * 0.6, 0, 1.6);
    phase += dt * (2.2 + 2.6 * turb);

    const J0 = JUMP_XF - ROLLER_HALF;
    const J1 = JUMP_XF + ROLLER_HALF;
    const depthAt = (xf: number) =>
      xf <= J0 ? Y1 : xf >= J1 ? RES.y2 : Y1 + (RES.y2 - Y1) * smoothstep(J0, J1, xf);
    const q = V1 * Y1;
    const velAt = (xf: number) => q / Math.max(depthAt(xf), 1e-6);

    // water body
    const steps = 60;
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    for (let i = 0; i <= steps; i++) {
      const xf = i / steps;
      ctx.lineTo(xf * width, surfaceY(depthAt(xf)));
    }
    ctx.lineTo(width, bedY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, ceil, 0, bedY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.75 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // surface line
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#7dd3fc" : "#0284c7";
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const xf = i / steps;
      const ripple = xf > J0 && xf < J1 ? Math.sin(xf * 60 + phase * 4) * 2 * turb : 0;
      const y = surfaceY(depthAt(xf)) + ripple;
      i === 0 ? ctx.moveTo(xf * width, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();

    // particles
    for (const p of particles) {
      const vel = velAt(p.xf);
      p.xf += vel * 0.045 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = Math.random() * 2 - 1;
        p.seed = Math.random() * Math.PI * 2;
      }
      const d = depthAt(p.xf);
      const surf = surfaceY(d);
      const colH = bedY - surf;
      let py = bedY - (0.5 + 0.45 * p.f) * colH;
      const inRoller = p.xf > J0 && p.xf < J1;
      if (inRoller) py += Math.sin(phase * 3 + p.seed * 5) * colH * 0.4 * turb;
      py = clamp(py, surf + 1, bedY - 1);
      ctx.beginPath();
      ctx.arc(p.xf * width, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(vel / V1, 0, 1), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
