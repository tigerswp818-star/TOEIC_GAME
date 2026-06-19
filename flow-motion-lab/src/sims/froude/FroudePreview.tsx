import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor, depthColor } from "@/lib/colors";

// A fixed supercritical scene (Fr > 1): rings born at the source are swept
// downstream faster than they expand, forming a Mach-like wedge.
const SOURCE_XF = 0.28;
const C_PX = 26; // wave celerity (px/s) — ring growth rate
const V_PX = 64; // flow speed (px/s) — V > c → supercritical wedge
const EMIT_PERIOD = 0.7; // seconds between rings
const RING_MAX_AGE = 3.2;

const particles = Array.from({ length: 50 }, () => ({
  xf: Math.random(),
  df: 0.15 + Math.random() * 0.7,
}));

interface Ring {
  age: number;
}

/** Looping mini view of a supercritical channel with a swept wave wedge. */
export default function FroudePreview() {
  const rings: Ring[] = [];
  let emit = 0;

  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const bedY = height * 0.86;
    const surfaceY = height * 0.42;
    const depthPx = bedY - surfaceY;

    // water body
    ctx.beginPath();
    ctx.rect(0, surfaceY, width, bedY - surfaceY);
    const grad = ctx.createLinearGradient(0, surfaceY, 0, bedY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.75 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // surface line
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = dark ? "rgba(165,243,252,0.85)" : "rgba(14,116,144,0.75)";
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    ctx.lineTo(width, surfaceY);
    ctx.stroke();

    // emit + age rings (all motion via dt)
    emit += dt;
    if (emit >= EMIT_PERIOD) {
      emit -= EMIT_PERIOD;
      rings.push({ age: 0 });
    }
    for (const r of rings) r.age += dt;
    for (let i = rings.length - 1; i >= 0; i--) {
      if (rings[i].age >= RING_MAX_AGE) rings.splice(i, 1);
    }

    const srcX = SOURCE_XF * width;
    const ringCol = dark ? "#fb7185" : "#e11d48"; // rose = supercritical
    for (const r of rings) {
      const radius = C_PX * r.age;
      const cx = srcX + V_PX * r.age; // swept downstream
      const fade = Math.max(0, 1 - r.age / RING_MAX_AGE);
      if (radius < 1) continue;
      ctx.save();
      ctx.globalAlpha = 0.8 * fade;
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, surfaceY, radius, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // particles streaming fast (supercritical)
    for (const p of particles) {
      p.xf += 0.16 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.df = 0.15 + Math.random() * 0.7;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, bedY - p.df * depthPx, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.9, 0.95);
      ctx.fill();
    }

    // the disturbance source ("stone")
    ctx.beginPath();
    ctx.arc(srcX, surfaceY, 3, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.fill();
  };

  return <MiniPreview draw={draw} />;
}
