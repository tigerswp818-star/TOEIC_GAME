import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { softGlow } from "@/lib/render/draw";

// Bubbles forming and collapsing near a pump eye (cavitation).
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cx = width * 0.62;
  const cy = height / 2;
  const R = Math.min(width, height) * 0.34;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = dark ? "rgba(56,189,248,0.14)" : "rgba(207,250,254,0.6)";
  ctx.fill();
  ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const t = (time * (0.7 + i * 0.05) + i * 0.4) % 1;
    const grow = Math.sin(t * Math.PI);
    const bx = cx - R * 0.3 + (i % 4) * R * 0.18;
    const by = cy - R * 0.4 + ((i * 7) % 5) * R * 0.16;
    if (t > 0.82) softGlow(ctx, bx, by, 6, "248,250,252", 0.5);
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(0.5, grow * 3.5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226,240,255,${0.3 + 0.5 * grow})`;
    ctx.fill();
  }
}

export default function CavitationPreview() {
  return <MiniPreview draw={draw} />;
}
