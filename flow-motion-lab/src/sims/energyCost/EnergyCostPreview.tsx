import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Animated energy bars suggesting kWh / cost.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const n = 5;
  const gap = width * 0.06;
  const bw = (width - gap * (n + 1)) / n;
  const base = height * 0.82;
  for (let i = 0; i < n; i++) {
    const h = (0.35 + 0.5 * Math.abs(Math.sin(time * 1.2 + i * 0.7))) * (height * 0.6);
    const x = gap + i * (bw + gap);
    const y = base - h;
    const grad = ctx.createLinearGradient(0, y, 0, base);
    grad.addColorStop(0, dark ? "#22d3ee" : "#0891b2");
    grad.addColorStop(1, "#7c3aed");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, bw, h);
  }
  ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
  ctx.fillRect(0, base, width, 1.5);
}

export default function EnergyCostPreview() {
  return <MiniPreview draw={draw} />;
}
