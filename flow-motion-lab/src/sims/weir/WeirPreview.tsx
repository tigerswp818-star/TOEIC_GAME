import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor, depthColor } from "@/lib/colors";
import { clamp } from "@/lib/math";
import { seedParticles, type WeirParticle } from "./weirModel";

const particles: WeirParticle[] = seedParticles(56);

/** Looping mini view of water spilling over a weir crest as a falling nappe. */
export default function WeirPreview() {
  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const bedY = height * 0.9;
    const crestX = width * 0.52;
    const crestY = height * 0.46;
    const poolSurfaceY = crestY - height * 0.22;
    const plateW = Math.max(4, width * 0.018);

    // upstream pool (depth-shaded) with a gentle surface wave
    const surfWave = (xf: number) =>
      poolSurfaceY + Math.sin(xf * 9 + time * 1.4) * 2;
    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= 40; i++) {
      const xf = (i / 40) * (crestX / width);
      ctx.lineTo(xf * width, surfWave(xf));
    }
    ctx.lineTo(crestX, bedY);
    ctx.lineTo(0, bedY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, poolSurfaceY, 0, bedY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.7 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // tailwater
    ctx.fillStyle = depthColor(0.9, dark ? 0.5 : 0.65);
    ctx.fillRect(crestX, bedY - height * 0.07, width - crestX, height * 0.07);

    // bed
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    ctx.lineTo(width, bedY);
    ctx.stroke();

    // weir plate (water flows over the crest)
    ctx.fillStyle = dark ? "#475569" : "#94a3b8";
    ctx.fillRect(crestX - plateW / 2, crestY, plateW, bedY - crestY);

    // particles: approach across pool, then fall as a nappe
    for (const p of particles) {
      if (p.xf < 0.5) {
        const accel = 1 + (p.xf / 0.5) * 1.6;
        p.xf += 0.12 * accel * dt;
        if (p.xf >= 0.5) {
          p.f = Math.random();
          p.seed = Math.random();
        }
      } else {
        p.xf += 0.42 * dt;
        if (p.xf > 1) {
          p.xf = Math.random() * 0.45;
          p.f = Math.random();
          p.seed = Math.random();
        }
      }

      let px: number;
      let py: number;
      let tNorm: number;
      if (p.xf < 0.5) {
        const a = p.xf / 0.5;
        px = a * crestX;
        const colTop = surfWave(a * (crestX / width));
        py = colTop + p.f * (bedY - colTop) * 0.96;
        tNorm = clamp(0.1 + a * 0.4, 0, 1);
      } else {
        const fall = (p.xf - 0.5) / 0.5;
        const xStart = crestX + plateW / 2;
        px = xStart + (p.f - 0.5) * 6 + fall * (width * 0.2) * (0.8 + p.seed * 0.4);
        const drop = bedY - crestY;
        py = clamp(crestY + fall * fall * drop, crestY, bedY - 2);
        tNorm = clamp(0.45 + fall * 0.55, 0, 1);
      }
      ctx.beginPath();
      ctx.arc(px, py, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
