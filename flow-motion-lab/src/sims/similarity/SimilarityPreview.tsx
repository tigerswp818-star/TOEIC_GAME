import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { velocityColor } from "@/lib/colors";

// Froude-style preview: a large prototype (slow) and a small model (also slow,
// V_m = V_p·√λ) side by side, each with their own flowing particles, so the
// "big + small with matched flows" story reads at a glance.
const LAMBDA = 0.36;
const V_P = 1.4;
const V_M = V_P * Math.sqrt(LAMBDA);

interface P {
  xf: number;
  f: number;
}
const seed = (n: number): P[] =>
  Array.from({ length: n }, () => ({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.8 }));
const protoParticles = seed(24);
const modelParticles = seed(18);

/** Compact preview: a big prototype + small scaled model with matched flows. */
export default function SimilarityPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const gap = width * 0.06;
    const panelW = (width - gap) / 2;
    const maxVel = Math.max(V_P, V_M, 1e-6);

    const panels = [
      { x0: 0, vel: V_P, objHalf: 0.32, particles: protoParticles },
      { x0: panelW + gap, vel: V_M, objHalf: 0.32 * 0.6, particles: modelParticles },
    ];

    for (const p of panels) {
      const cx = p.x0 + panelW / 2;
      const centerY = height / 2;
      const bandHalf = height * 0.42;
      const top = centerY - bandHalf;
      const bot = centerY + bandHalf;

      // flow band edges
      ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x0, top);
      ctx.lineTo(p.x0 + panelW, top);
      ctx.moveTo(p.x0, bot);
      ctx.lineTo(p.x0 + panelW, bot);
      ctx.stroke();

      // object (hull silhouette)
      const objH = bandHalf * 2 * p.objHalf;
      const objW = objH * 1.7;
      const oy = centerY;
      ctx.fillStyle = dark ? "rgba(148,163,184,0.85)" : "rgba(71,85,105,0.85)";
      ctx.beginPath();
      ctx.moveTo(cx - objW / 2, oy - objH / 2);
      ctx.lineTo(cx + objW * 0.18, oy - objH / 2);
      ctx.quadraticCurveTo(cx + objW / 2, oy - objH / 2, cx + objW / 2, oy);
      ctx.quadraticCurveTo(cx + objW / 2, oy + objH / 2, cx + objW * 0.18, oy + objH / 2);
      ctx.lineTo(cx - objW / 2, oy + objH / 2);
      ctx.quadraticCurveTo(cx - objW * 0.72, oy, cx - objW / 2, oy - objH / 2);
      ctx.closePath();
      ctx.fill();

      // particles
      for (const part of p.particles) {
        part.xf += p.vel * 0.12 * dt;
        if (part.xf > 1) {
          part.xf -= 1;
          part.f = (Math.random() * 2 - 1) * 0.8;
        }
        const px = p.x0 + part.xf * panelW;
        const py = centerY + part.f * (bandHalf * 0.85);
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(Math.min(1, p.vel / maxVel), 0.95);
        ctx.fill();
      }
    }

    // "=" connector showing the matched (equal) dimensionless numbers
    ctx.fillStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.font = "bold 16px 'IBM Plex Sans Thai', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("=", width / 2, height / 2);
  };

  return <MiniPreview draw={draw} />;
}
