import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

interface PreviewBubble {
  xf: number;
  yf: number;
  phase: number; // 0..1 grow→pop cycle offset
  speed: number;
  maxR: number;
}

const bubbles: PreviewBubble[] = Array.from({ length: 7 }, () => ({
  xf: 0.55 + (Math.random() * 2 - 1) * 0.12,
  yf: 0.4 + (Math.random() * 2 - 1) * 0.18,
  phase: Math.random(),
  speed: 0.5 + Math.random() * 0.5,
  maxR: 3 + Math.random() * 3,
}));

/** Compact looping view: a pump suction with vapour bubbles forming & collapsing. */
export default function NpshPreview() {
  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const pumpX = width * 0.6;
    const pumpY = height * 0.45;
    const pumpR = height * 0.26;
    const inletX = pumpX - pumpR;

    // suction pipe stub coming in from the left into the pump inlet
    const pipeW = height * 0.16;
    ctx.fillStyle = dark ? "rgba(14,116,144,0.25)" : "rgba(165,243,252,0.5)";
    ctx.fillRect(0, pumpY - pipeW / 2, inletX, pipeW);
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, pumpY - pipeW / 2);
    ctx.lineTo(inletX, pumpY - pipeW / 2);
    ctx.moveTo(0, pumpY + pipeW / 2);
    ctx.lineTo(inletX, pumpY + pipeW / 2);
    ctx.stroke();

    // pump volute with a slowly spinning impeller
    ctx.save();
    ctx.beginPath();
    ctx.arc(pumpX, pumpY, pumpR, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(pumpX, pumpY, pumpR * 0.2, pumpX, pumpY, pumpR);
    pg.addColorStop(0, dark ? "rgba(56,189,248,0.5)" : "rgba(125,211,252,0.7)");
    pg.addColorStop(1, dark ? "rgba(14,116,144,0.35)" : "rgba(8,145,178,0.35)");
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#0e7490";
    ctx.stroke();
    ctx.translate(pumpX, pumpY);
    ctx.rotate(dt > 0 ? time * 3 : 0);
    ctx.strokeStyle = dark ? "#bae6fd" : "#0369a1";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pumpR * 0.65, pumpR * 0.2);
      ctx.stroke();
    }
    ctx.restore();

    // vapour bubbles forming at the inlet, growing then popping
    for (const b of bubbles) {
      b.phase += b.speed * dt;
      if (b.phase > 1) b.phase -= 1;
      const cx = inletX + b.xf * pumpR * 0.6;
      const cy = pumpY + (b.yf - 0.4) * pumpR * 1.2;
      if (b.phase < 0.8) {
        // grow phase
        const g = b.phase / 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy - g * 6, b.maxR * (0.3 + 0.7 * g), 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(248,250,252,0.6)" : "rgba(255,255,255,0.75)";
        ctx.fill();
        ctx.strokeStyle = dark ? "rgba(186,230,253,0.7)" : "rgba(8,145,178,0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // collapse flash ring
        const f = (b.phase - 0.8) / 0.2;
        ctx.beginPath();
        ctx.arc(cx, cy - 6, b.maxR * (1 + f), 0, Math.PI * 2);
        ctx.strokeStyle = dark
          ? `rgba(253,164,175,${0.7 * (1 - f)})`
          : `rgba(225,29,72,${0.7 * (1 - f)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  };

  return <MiniPreview draw={draw} />;
}
