import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

// Three pump rotors — two running (spinning) + one standby.
function draw({ ctx, width, height, time, theme }: DrawContext) {
  const dark = theme === "dark";
  const cy = height / 2;
  const R = Math.min(width, height) * 0.16;
  const xs = [width * 0.27, width * 0.5, width * 0.73];
  xs.forEach((cx, i) => {
    const running = i < 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = running ? (dark ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.2)") : dark ? "rgba(71,85,105,0.2)" : "rgba(203,213,225,0.4)";
    ctx.fill();
    ctx.strokeStyle = running ? "#10b981" : dark ? "#475569" : "#94a3b8";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(running ? time * (1.5 + i * 0.3) : 0);
    ctx.strokeStyle = running ? (dark ? "#67e8f9" : "#0891b2") : dark ? "#475569" : "#94a3b8";
    ctx.lineWidth = 2.2;
    for (let v = 0; v < 5; v++) {
      const a = (v / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
      ctx.lineTo(Math.cos(a + 0.6) * R * 0.7, Math.sin(a + 0.6) * R * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  });
}

export default function MultiPumpPreview() {
  return <MiniPreview draw={draw} />;
}
