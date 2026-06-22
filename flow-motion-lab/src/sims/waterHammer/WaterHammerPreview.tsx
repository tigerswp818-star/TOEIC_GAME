import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// A red pressure wave sweeping back along a pipe toward a closed valve.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cy = height / 2;
  const pipeH = height * 0.4;
  ctx.fillStyle = dark ? "rgba(34,211,238,0.14)" : "rgba(165,243,252,0.5)";
  ctx.fillRect(0, cy - pipeH / 2, width, pipeH);
  // wave front sweeping right→left on a loop
  const tp = (time % 2.4) / 2.4;
  const frontX = (1 - tp) * width;
  ctx.fillStyle = "rgba(239,68,68,0.55)";
  ctx.fillRect(frontX, cy - pipeH / 2, width - frontX, pipeH);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(frontX, cy - pipeH / 2);
  ctx.lineTo(frontX, cy + pipeH / 2);
  ctx.stroke();
  // valve at right
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(width - 5, cy - pipeH / 2, 5, pipeH);
  ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, cy - pipeH / 2, width, pipeH);
}

export default function WaterHammerPreview() {
  return <MiniPreview draw={draw} />;
}
