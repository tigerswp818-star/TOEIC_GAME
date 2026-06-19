import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { sampleCurve, affinityPoint, maxFlow, maxHead, N_REF } from "./affinityModel";

// Looping mini view: a spinning impeller on the left whose rate tracks N, and a
// Q–H curve on the right that shifts up/down as the pump speed N breathes
// between ~70% and ~120% over time. All motion is driven by `time`/`dt`.
let spin = 0;

/** Dashboard preview for the Pump Affinity Laws simulation. */
export default function AffinityPreview() {
  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";

    // Breathe the pump speed N between ~70% and ~120%.
    const n = 95 + 25 * Math.sin(time * 0.7);
    const r = n / N_REF;
    const { q, h } = affinityPoint(n);

    // --- spinning impeller (left third) ---
    const cx = width * 0.2;
    const cy = height / 2;
    const rad = height * 0.32;
    spin += dt * (2 + r * 7);

    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(56,189,248,0.4)" : "rgba(125,211,252,0.6)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#0e7490";
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.strokeStyle = dark ? "#bae6fd" : "#0369a1";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(rad * 0.45, rad * 0.12, rad * 0.72, rad * 0.32);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, rad * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0369a1" : "#0e7490";
    ctx.fill();
    ctx.restore();

    // --- Q–H chart (right two-thirds) ---
    const pad = { l: width * 0.42, r: 8, t: 10, b: 10 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    const qMax = maxFlow();
    const yMax = maxHead();
    const sx = (qq: number) => pad.l + (qq / Math.max(qMax, 1e-6)) * plotW;
    const sy = (hh: number) => pad.t + (1 - hh / Math.max(yMax, 1e-6)) * plotH;

    // axes
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.4)" : "rgba(100,116,139,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, height - pad.b);
    ctx.lineTo(width - pad.r, height - pad.b);
    ctx.stroke();

    const stroke = (
      pts: { x: number; y: number }[],
      color: string,
      dashed: boolean,
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dashed ? [4, 3] : []);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = sx(p.x);
        const py = sy(p.y);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    stroke(sampleCurve(N_REF, qMax, 30), dark ? "#64748b" : "#94a3b8", true); // reference 100%
    stroke(sampleCurve(n, qMax, 30), "#06b6d4", false); // current N

    // current operating point (pulsing)
    const pr = 3 + 1.2 * (0.5 + 0.5 * Math.sin(time * 3));
    ctx.beginPath();
    ctx.arc(sx(q), sy(h), pr, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
