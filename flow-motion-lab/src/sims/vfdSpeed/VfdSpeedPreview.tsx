import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { softGlow } from "@/lib/render/draw";

// A spinning pump impeller — speed gently oscillates to suggest VFD ramping.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.38;
  // speed varies 0.4..1 like a VFD changing frequency
  const speed = 0.7 + 0.3 * Math.sin(time * 0.8);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "rgba(56,189,248,0.14)" : "rgba(207,250,254,0.6)";
  ctx.fill();
  ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
  ctx.lineWidth = 3;
  ctx.stroke();
  softGlow(ctx, cx, cy, R * 0.9, "103, 232, 249", 0.18 * speed);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * speed * 6);
  ctx.strokeStyle = dark ? "rgba(103,232,249,0.95)" : "rgba(8,145,178,0.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
    ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.6, Math.sin(a + 0.5) * R * 0.6, Math.cos(a + 0.9) * R * 0.85, Math.sin(a + 0.9) * R * 0.85);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "#1e3a5f" : "#cbd5e1";
  ctx.fill();
}

export default function VfdSpeedPreview() {
  return <MiniPreview draw={draw} />;
}
