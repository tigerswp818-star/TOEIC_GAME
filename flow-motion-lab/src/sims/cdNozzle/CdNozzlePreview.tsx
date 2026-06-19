import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { areaAt, pressureTrend, speedProxy, THROAT_XF } from "./cdNozzleModel";
import { pressureColor } from "@/lib/colors";

// A choked, supersonic operating point so the preview shows the throat
// accelerating the flow into the diverging section.
const P_RATIO = 0.25;
const THROAT_AREA = 0.35;
const particles = Array.from({ length: 70 }, () => ({
  xf: Math.random(),
  f: (Math.random() * 2 - 1) * 0.82,
}));

/** Looping mini view of the C-D nozzle for the dashboard card. */
export default function CdNozzlePreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const centerY = height / 2;
    const maxHalf = height * 0.42;
    const halfAt = (xf: number) => maxHalf * areaAt(xf, THROAT_AREA);
    const dark = theme === "dark";

    // nozzle walls (converging then diverging)
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xf = i / 60;
        const y = centerY + sgn * halfAt(xf);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(xf * width, y);
      }
      ctx.stroke();
    }

    // throat marker
    const throatX = THROAT_XF * width;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = dark ? "rgba(253,230,138,0.7)" : "rgba(180,83,9,0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(throatX, centerY - halfAt(THROAT_XF));
    ctx.lineTo(throatX, centerY + halfAt(THROAT_XF));
    ctx.stroke();
    ctx.restore();

    // particles accelerating through the throat, coloured by pressure/regime
    for (const p of particles) {
      const sp = speedProxy(p.xf, P_RATIO, THROAT_AREA);
      p.xf += sp * 0.14 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.82;
      }
      ctx.beginPath();
      ctx.arc(p.xf * width, centerY + p.f * halfAt(p.xf), 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pressureColor(pressureTrend(p.xf, P_RATIO, THROAT_AREA), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
