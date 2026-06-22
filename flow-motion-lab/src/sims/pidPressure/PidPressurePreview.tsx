import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Actual pressure (cyan) tracking a dashed target with a little overshoot.
function draw({ ctx, width, height, time }: DrawContext) {
  const targetY = height * 0.45;
  // target dashed line
  ctx.strokeStyle = "#f59e0b";
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, targetY);
  ctx.lineTo(width * 0.94, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
  // actual trace: step response with overshoot, scrolling
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let k = 0; k <= 50; k++) {
    const f = k / 50;
    const x = width * 0.08 + f * width * 0.86;
    // damped step response around target
    const tt = f * 6 - (time % 6);
    const resp = tt < 0 ? 0 : 1 - Math.exp(-tt * 1.2) * Math.cos(tt * 3);
    const y = targetY + (1 - resp) * height * 0.32;
    k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export default function PidPressurePreview() {
  return <MiniPreview draw={draw} />;
}
