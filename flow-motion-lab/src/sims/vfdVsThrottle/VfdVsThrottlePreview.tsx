import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Two bars: throttle (tall, red) vs VFD (short, green) — energy comparison.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const base = height * 0.82;
  const bw = width * 0.22;
  const pulse = 0.92 + 0.08 * Math.sin(time * 1.5);
  const th = height * 0.55 * pulse;
  const vf = height * 0.28 * pulse;
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(width * 0.22, base - th, bw, th);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(width * 0.56, base - vf, bw, vf);
  ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
  ctx.fillRect(0, base, width, 1.5);
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "center";
  ctx.fillText("วาล์ว", width * 0.33, base + 11);
  ctx.fillStyle = "#10b981";
  ctx.fillText("VFD", width * 0.67, base + 11);
}

export default function VfdVsThrottlePreview() {
  return <MiniPreview draw={draw} />;
}
