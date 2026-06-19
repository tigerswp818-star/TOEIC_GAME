import { useRef } from "react";
import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor } from "@/lib/colors";
import { stepHeel, type HeelState } from "./floatingStabilityModel";

const SURFACE_F = 0.46; // water surface as a fraction of preview height
const GM = 0.6; // a positive (stable) metacentric height for the rock
const G_COLOR = "#f43f5e";
const M_COLOR = "#a855f7";

/** Compact looping view: a stable boat rocking and settling upright in water. */
export default function FloatingStabilityPreview() {
  const heelRef = useRef<HeelState>({ angle: 0.5, omega: 0 });
  const kickRef = useRef(0);

  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const surfaceY = SURFACE_F * height;

    // depth-shaded water
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfaceY + f0 * (height - surfaceY);
      const y1 = surfaceY + f1 * (height - surfaceY);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(0, y0, width, y1 - y0 + 1);
    }

    // wavy surface line
    ctx.beginPath();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    for (let i = 0; i <= 40; i++) {
      const xf = i / 40;
      const y = surfaceY + Math.sin(time * 1.6 + xf * 10) * 1.6;
      i === 0 ? ctx.moveTo(xf * width, y) : ctx.lineTo(xf * width, y);
    }
    ctx.stroke();

    // periodically re-kick the rock so the loop keeps showing it settle upright
    kickRef.current += dt;
    if (kickRef.current > 3 && Math.abs(heelRef.current.angle) < 0.02) {
      heelRef.current = { angle: 0.55 * (Math.random() > 0.5 ? 1 : -1), omega: 0 };
      kickRef.current = 0;
    }
    heelRef.current = stepHeel(heelRef.current, { gm: GM, baseRad: 0 }, dt);
    const angle = heelRef.current.angle;

    const cx = width / 2;
    const halfBeam = width * 0.22;
    const draftPx = height * 0.16;
    const freeboard = height * 0.14;

    ctx.save();
    ctx.translate(cx, surfaceY);
    ctx.rotate(angle);

    // hull
    ctx.beginPath();
    ctx.moveTo(-halfBeam, -freeboard);
    ctx.lineTo(halfBeam, -freeboard);
    ctx.lineTo(halfBeam * 0.78, draftPx);
    ctx.lineTo(-halfBeam * 0.78, draftPx);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(251,191,36,0.95)" : "rgba(245,158,11,0.95)";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.stroke();

    // G (centre of gravity) dot + M (metacentre) diamond on the centreline
    const gY = draftPx - height * 0.16;
    const mY = draftPx - height * 0.3;
    ctx.beginPath();
    ctx.arc(0, gY, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = G_COLOR;
    ctx.fill();

    ctx.save();
    ctx.translate(0, mY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = M_COLOR;
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();

    ctx.restore();
  };

  return <MiniPreview draw={draw} />;
}
