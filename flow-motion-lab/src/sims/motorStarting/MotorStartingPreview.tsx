import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Current-vs-time: a tall DOL spike (red) vs a low smooth VFD line (green).
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const base = height * 0.85;
  const top = height * 0.12;
  // axes
  ctx.strokeStyle = dark ? "rgba(148,163,184,0.4)" : "rgba(100,116,139,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, top);
  ctx.lineTo(width * 0.1, base);
  ctx.lineTo(width * 0.92, base);
  ctx.stroke();
  const X = (t: number) => width * 0.1 + t * (width * 0.82);
  const Y = (i: number) => base - (i / 7) * (base - top);
  // DOL spike (red)
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const i = 1 + 5.5 * Math.exp(-(t * 5) / 0.9);
    k === 0 ? ctx.moveTo(X(t), Y(i)) : ctx.lineTo(X(t), Y(i));
  }
  ctx.stroke();
  // VFD low line (green)
  ctx.strokeStyle = "#10b981";
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const i = t * 5 < 3.2 ? 1.3 : 1.0;
    k === 0 ? ctx.moveTo(X(t), Y(i)) : ctx.lineTo(X(t), Y(i));
  }
  ctx.stroke();
  // moving marker on DOL
  const tt = (time % 3) / 3;
  const iy = 1 + 5.5 * Math.exp(-(tt * 5) / 0.9);
  ctx.fillStyle = "#fca5a5";
  ctx.beginPath();
  ctx.arc(X(tt), Y(iy), 3, 0, Math.PI * 2);
  ctx.fill();
}

export default function MotorStartingPreview() {
  return <MiniPreview draw={draw} />;
}
