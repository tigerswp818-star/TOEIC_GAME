import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { turbulentProfile, type ProfileParticle } from "./turbulentProfileModel";
import { velocityColor } from "@/lib/colors";

const UMAX = 3;
const N = 8; // fairly turbulent → nice flat profile
const particles: ProfileParticle[] = Array.from({ length: 48 }, () => ({
  xf: Math.random(),
  rf: Math.random() * 2 - 1,
  seed: Math.random() * Math.PI * 2,
}));
let phase = 0;

/**
 * Compact preview: a flat turbulent particle profile — most particles travel at
 * similar speed across the core, with only a thin slow layer near each wall.
 */
export default function TurbulentProfilePreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const centerY = height / 2;
    const halfH = height * 0.4;
    const top = centerY - halfH;
    const bot = centerY + halfH;

    phase += dt * 6;

    // pipe walls
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    const vel = (rf: number) => turbulentProfile(Math.abs(rf), 1, UMAX, N);
    const maxVel = UMAX;

    // particles flowing in radial layers at u(r)
    for (const p of particles) {
      const v = vel(p.rf);
      p.xf += v * 0.08 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.rf = Math.random() * 2 - 1;
        p.seed = Math.random() * Math.PI * 2;
      }
      const jitter = 0.05 * (1 - Math.abs(p.rf)) * Math.sin(phase * 1.7 + p.seed * 5);
      const rfShown = Math.max(-0.97, Math.min(0.97, p.rf + jitter));
      const y = centerY + rfShown * halfH;
      ctx.beginPath();
      ctx.arc(p.xf * width, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, v / maxVel), 0.95);
      ctx.fill();
    }

    // flat turbulent profile sketch near the right
    const baseX = width * 0.66;
    const scaleX = width * 0.26;
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const rf = -1 + (i / 40) * 2;
      const u = vel(rf) / maxVel;
      const x = baseX + u * scaleX;
      const y = centerY + rf * halfH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
