import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// A magnifier scanning over a checklist — diagnostic feel.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const rows = 4;
  const left = width * 0.18;
  const top = height * 0.24;
  const gap = (height * 0.5) / (rows - 1);
  for (let i = 0; i < rows; i++) {
    const y = top + i * gap;
    // check box
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, y - 4, 8, 8);
    ctx.beginPath();
    ctx.moveTo(left + 1.5, y);
    ctx.lineTo(left + 3.5, y + 2.5);
    ctx.lineTo(left + 6.5, y - 2.5);
    ctx.stroke();
    // line
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.5)";
    ctx.beginPath();
    ctx.moveTo(left + 14, y);
    ctx.lineTo(width * 0.7, y);
    ctx.stroke();
  }
  // magnifier moving
  const mx = width * 0.5 + Math.sin(time * 1.2) * width * 0.22;
  const my = top + (1.5 + Math.sin(time * 0.8)) * gap;
  const r = Math.min(width, height) * 0.13;
  ctx.strokeStyle = "#a78bfa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx + r * 0.7, my + r * 0.7);
  ctx.lineTo(mx + r * 1.4, my + r * 1.4);
  ctx.stroke();
}

export default function TroubleshootingPreview() {
  return <MiniPreview draw={draw} />;
}
