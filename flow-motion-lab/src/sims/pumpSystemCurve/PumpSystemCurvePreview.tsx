import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { softGlow, pulse } from "@/lib/render/draw";

// Simplified pump/system curves with a pulsing operating point at the crossing.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const pad = 10;
  const x = (q: number) => pad + q * (width - pad * 2);
  const y = (h: number) => height - pad - h * (height - pad * 2);
  const H0 = 0.95;
  const Bp = 0.85;
  const hs = 0.18;
  const K = 0.9;
  const pumpH = (q: number) => H0 - Bp * q * q;
  const sysH = (q: number) => hs + K * q * q;
  // operating point: H0 - Bp q² = hs + K q²  → q² = (H0-hs)/(Bp+K)
  const qop = Math.sqrt((H0 - hs) / (Bp + K));
  const hop = sysH(qop);

  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  // pump curve (cyan)
  ctx.strokeStyle = dark ? "#22d3ee" : "#0891b2";
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const q = i / 40;
    const h = pumpH(q);
    if (h < 0) break;
    i === 0 ? ctx.moveTo(x(q), y(h)) : ctx.lineTo(x(q), y(h));
  }
  ctx.stroke();
  // system curve (orange)
  ctx.strokeStyle = "#f59e0b";
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const q = i / 40;
    i === 0 ? ctx.moveTo(x(q), y(sysH(q))) : ctx.lineTo(x(q), y(sysH(q)));
  }
  ctx.stroke();
  // operating point with pulsing glow
  const px = x(qop);
  const py = y(hop);
  softGlow(ctx, px, py, 10 + 5 * pulse(time, 1.4), "167, 139, 250", 0.5);
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "#a78bfa";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

export default function PumpSystemCurvePreview() {
  return <MiniPreview draw={draw} />;
}
