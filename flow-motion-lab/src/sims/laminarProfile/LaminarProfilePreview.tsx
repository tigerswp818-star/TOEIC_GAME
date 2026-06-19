import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityProfile } from "./laminarProfileModel";
import { velocityColor } from "@/lib/colors";

const R = 1; // normalised radius
const U_MAX = 1; // normalised centreline speed
const SPEED = 0.5; // normalised xf per second per (u/u_max)
const particles = Array.from({ length: 70 }, () => ({
  xf: Math.random(),
  rf: Math.random() * 2 - 1,
}));

/** Looping mini view of a pipe with a parabolic particle profile (fast centre, slow walls). */
export default function LaminarProfilePreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const centerY = height / 2;
    const halfH = height * 0.4;
    const top = centerY - halfH;
    const bot = centerY + halfH;
    const dark = theme === "dark";

    // pipe walls
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    // parabolic profile curve on the left
    const baseX = width * 0.1;
    const maxLen = width * 0.42;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const rf = -1 + (i / 36) * 2;
      const vel = velocityProfile(rf * R, R, U_MAX);
      const x = baseX + vel * maxLen;
      const y = centerY + rf * halfH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // particles in horizontal layers, speed = u(r)
    for (const p of particles) {
      const vel = velocityProfile(p.rf * R, R, U_MAX);
      p.xf += vel * SPEED * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.rf = Math.random() * 2 - 1;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + p.rf * halfH, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, vel), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
