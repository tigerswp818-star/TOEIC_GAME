import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { frictionCurve, laminarCurve } from "./moodyModel";

const RE_LO = Math.log10(1e3);
const RE_HI = Math.log10(1e8);
const F_LO = Math.log10(0.008);
const F_HI = Math.log10(0.1);

// A couple of Moody-style curves precomputed once.
const CURVES = [
  { color: 0, pts: laminarCurve(1e3, 2300, 18) },
  { color: 1, pts: frictionCurve(0.0005, 4000, 1e8, 40) },
  { color: 1, pts: frictionCurve(0.02, 4000, 1e8, 40) },
];

let t = 0;

/**
 * Compact preview: a couple of log–log Moody curves with a marker that sweeps
 * back and forth across the turbulent curve, hinting at the interactive chart.
 */
export default function MoodyPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const padL = width * 0.06;
    const padR = width * 0.04;
    const padT = height * 0.12;
    const padB = height * 0.12;

    const x = (re: number) =>
      padL + ((Math.log10(Math.max(re, 1)) - RE_LO) / (RE_HI - RE_LO)) * (width - padL - padR);
    const y = (f: number) =>
      height - padB - ((Math.log10(Math.max(f, 1e-6)) - F_LO) / (F_HI - F_LO)) * (height - padT - padB);

    ctx.lineWidth = 1.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const c of CURVES) {
      ctx.beginPath();
      c.pts.forEach((p, i) => {
        const px = x(p.re);
        const py = y(p.f);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      if (c.color === 0) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#f43f5e";
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = dark ? "rgba(103,232,249,0.7)" : "rgba(8,145,178,0.7)";
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Moving dot sweeping along the turbulent curve.
    t += dt * 0.25;
    const u = 0.5 - 0.5 * Math.cos(t); // 0→1→0 ping-pong
    const sweep = CURVES[1].pts;
    const idx = Math.min(sweep.length - 1, Math.floor(u * (sweep.length - 1)));
    const p = sweep[idx];
    ctx.beginPath();
    ctx.arc(x(p.re), y(p.f), 3, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
