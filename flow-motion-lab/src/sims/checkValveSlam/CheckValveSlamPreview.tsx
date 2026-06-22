import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { softGlow } from "@/lib/render/draw";

// A check-valve flap slamming shut with a red pressure flash, on a loop.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cy = height / 2;
  const pipeH = height * 0.46;
  const vx = width * 0.62;
  const tp = (time % 2.2) / 2.2;
  const closed = tp < 0.5 ? tp / 0.5 : 1; // closing then shut
  const slam = tp > 0.5 && tp < 0.72;
  ctx.fillStyle = dark ? "rgba(34,211,238,0.12)" : "rgba(165,243,252,0.45)";
  ctx.fillRect(0, cy - pipeH / 2, width, pipeH);
  if (slam) {
    ctx.fillStyle = "rgba(239,68,68,0.5)";
    ctx.fillRect(0, cy - pipeH / 2, vx, pipeH);
    softGlow(ctx, vx - 14, cy, pipeH * 0.9, "239,68,68", 0.5);
  }
  ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, cy - pipeH / 2, width, pipeH);
  // flap
  ctx.save();
  ctx.translate(vx, cy - pipeH / 2);
  ctx.rotate(-(1 - closed) * Math.PI * 0.5);
  ctx.fillStyle = slam ? "#ef4444" : "#f59e0b";
  ctx.fillRect(-3, 0, 6, pipeH);
  ctx.restore();
}

export default function CheckValveSlamPreview() {
  return <MiniPreview draw={draw} />;
}
