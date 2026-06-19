import { useRef } from "react";
import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { depthColor, velocityColor } from "@/lib/colors";
import { integrateLevel, seedStream } from "./controlVolumeModel";

/** Inflow > outflow then it reverses, so the level visibly oscillates. */
const Q_IN = 0.32;
const Q_OUT = 0.18;
const A_TANK = 1.5;
const FULL_VOLUME = 1.0;

/** Looping mini view of a control-volume tank filling and draining. */
export default function ControlVolumePreview() {
  const level = useRef(0.4);
  const inStream = useRef(seedStream(14));
  const outStream = useRef(seedStream(14));

  const draw = ({ ctx, width, height, dt, time, theme }: DrawContext) => {
    const dark = theme === "dark";

    // Oscillate the net rate so the level rises and falls in the loop.
    const phase = Math.sin(time * 0.5);
    const net = phase >= 0 ? Q_IN - Q_OUT : Q_OUT - Q_IN;
    level.current = integrateLevel(level.current, net, A_TANK, dt, FULL_VOLUME);
    const lvl = level.current;

    const tankLeft = width * 0.3;
    const tankRight = width * 0.7;
    const tankTop = height * 0.12;
    const tankBottom = height * 0.9;
    const tankW = tankRight - tankLeft;
    const tankH = tankBottom - tankTop;
    const surfacePx = tankBottom - lvl * tankH;

    // water
    if (lvl > 0.001) {
      const bands = 16;
      for (let i = 0; i < bands; i++) {
        const f0 = i / bands;
        const f1 = (i + 1) / bands;
        const y0 = surfacePx + f0 * (tankBottom - surfacePx);
        const y1 = surfacePx + f1 * (tankBottom - surfacePx);
        ctx.fillStyle = depthColor((f0 + f1) / 2, 0.8);
        ctx.fillRect(tankLeft, y0, tankW, y1 - y0 + 1);
      }
    }

    // tank walls (open top)
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(tankLeft, tankTop);
    ctx.lineTo(tankLeft, tankBottom);
    ctx.lineTo(tankRight, tankBottom);
    ctx.lineTo(tankRight, tankTop);
    ctx.stroke();

    // inflow stream (left → in)
    const inY = tankTop + tankH * 0.18;
    for (const p of inStream.current) {
      p.t += 1.2 * dt;
      if (p.t > 1) {
        p.t -= 1;
        p.j = Math.random() * 2 - 1;
      }
      const x = tankLeft - width * 0.18 + (tankW * 0.4 + width * 0.18) * p.t;
      const y = inY + p.j * 5;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.7, 0.95);
      ctx.fill();
    }

    // outflow stream (right → out)
    const outY = tankBottom - tankH * 0.12;
    for (const p of outStream.current) {
      p.t += 0.9 * dt;
      if (p.t > 1) {
        p.t -= 1;
        p.j = Math.random() * 2 - 1;
      }
      const x = tankRight - tankW * 0.1 + (width * 0.22) * p.t;
      const y = outY + p.j * 5;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(0.5, 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
