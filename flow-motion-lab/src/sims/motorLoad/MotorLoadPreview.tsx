import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Spinning induction-motor rotor inside a stator.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.36;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "rgba(30,58,95,0.4)" : "rgba(203,213,225,0.5)";
  ctx.fill();
  ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, R * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 4);
  ctx.fillStyle = dark ? "#0e7490" : "#0891b2";
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.fillRect(R * 0.18, -R * 0.05, R * 0.44, R * 0.1);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "#155e75" : "#0e7490";
  ctx.fill();
  ctx.restore();
}

export default function MotorLoadPreview() {
  return <MiniPreview draw={draw} />;
}
