import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { sampleCurves, operatingPoint, maxFlow } from "./pumpModel";

// A gently breathing valve so the preview is alive: the operating point slides
// left/right as resistance rises and falls.
const N = 100;
const H_STATIC = 10;

/** Looping mini view of the two crossing Q–H curves with an operating-point marker. */
export default function PumpCurvePreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const pad = { l: 10, r: 8, t: 10, b: 10 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;

    // Breathe the valve opening between ~45% and 100%.
    const valve = 72 + 28 * Math.sin(time * 0.9);
    const qMax = maxFlow();
    const { pump, system } = sampleCurves(N, H_STATIC, valve, qMax, 36);
    const { qOp, hOp } = operatingPoint(N, H_STATIC, valve);
    const yMax = pump[0].y * 1.1; // shut-off head sets the top of the plot

    const sx = (q: number) => pad.l + (q / Math.max(qMax, 1e-6)) * plotW;
    const sy = (h: number) => pad.t + (1 - h / Math.max(yMax, 1e-6)) * plotH;

    // axes
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.4)" : "rgba(100,116,139,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, height - pad.b);
    ctx.lineTo(width - pad.r, height - pad.b);
    ctx.stroke();

    const stroke = (pts: { x: number; y: number }[], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = sx(p.x);
        const py = sy(p.y);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    stroke(pump, "#06b6d4"); // pump curve (falls)
    stroke(system, "#f59e0b"); // system curve (rises)

    // operating-point marker (pulsing)
    const r = 3.5 + 1.2 * (0.5 + 0.5 * Math.sin(time * 3));
    ctx.beginPath();
    ctx.arc(sx(qOp), sy(hOp), r, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
