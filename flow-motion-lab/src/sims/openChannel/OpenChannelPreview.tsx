import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { manningVelocity, seedParticles } from "./openChannelModel";
import { velocityColor, depthColor } from "@/lib/colors";

const S = 0.012;
const N = 0.013;
const Y = 1.0;
const B = 3;
const particles = seedParticles(48);

/** Looping mini view of a sloped open channel with flowing water. */
export default function OpenChannelPreview() {
  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const bedLeftY = height * 0.34;
    const bedRightY = height * 0.82;
    const bedY = (xf: number) => bedLeftY + (bedRightY - bedLeftY) * xf;
    const depthPx = height * 0.22;
    const surfaceY = (xf: number) => bedY(xf) - depthPx;
    const v = manningVelocity(N, B, Y, S);
    const steps = 50;

    // shaded water body with a gentle surface wave
    const surfWave = (xf: number) =>
      surfaceY(xf) + Math.sin(xf * 7 + time * 1.6) * 3;
    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, surfWave(i / steps));
    for (let i = steps; i >= 0; i--) ctx.lineTo((i / steps) * width, bedY(i / steps));
    ctx.closePath();
    ctx.fillStyle = depthColor(0.7, dark ? 0.65 : 0.8);
    ctx.fill();

    // bed line
    ctx.beginPath();
    ctx.moveTo(0, bedY(0));
    ctx.lineTo(width, bedY(1));
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.stroke();

    // flowing particles
    const tNorm = Math.min(1, v / 4);
    for (const p of particles) {
      p.xf += v * 0.05 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.df = Math.random();
      }
      const py = bedY(p.xf) - p.df * depthPx;
      ctx.beginPath();
      ctx.arc(p.xf * width, py, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
