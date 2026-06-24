import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Mini station schematic: sump → pump → tank with flowing dots.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cy = height * 0.55;
  const sumpX = width * 0.08;
  const pumpX = width * 0.42;
  const tankX = width * 0.82;
  // pipe
  ctx.strokeStyle = dark ? "rgba(34,211,238,0.5)" : "rgba(8,145,178,0.5)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sumpX, cy);
  ctx.lineTo(tankX, cy);
  ctx.lineTo(tankX, cy - height * 0.28);
  ctx.stroke();
  // sump
  ctx.fillStyle = "rgba(56,189,248,0.4)";
  ctx.fillRect(sumpX - width * 0.06, cy, width * 0.1, height * 0.28);
  // tank
  ctx.fillStyle = "rgba(56,189,248,0.4)";
  ctx.fillRect(tankX - width * 0.05, cy - height * 0.28, width * 0.1, height * 0.28);
  // pump (spinning)
  ctx.save();
  ctx.translate(pumpX, cy);
  ctx.rotate(time * 4);
  ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
  ctx.lineWidth = 2.5;
  const R = height * 0.12;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); ctx.lineTo(Math.cos(a + 0.6) * R, Math.sin(a + 0.6) * R); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pumpX, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  // flow dots
  for (let i = 0; i < 5; i++) {
    const f = (time * 0.35 + i / 5) % 1;
    const x = sumpX + f * (tankX - sumpX);
    ctx.beginPath();
    ctx.arc(x, cy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#a5f3fc" : "#0891b2";
    ctx.fill();
  }
}

export default function StationOverviewPreview() {
  return <MiniPreview draw={draw} />;
}
