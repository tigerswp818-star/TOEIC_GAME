import { useRef } from "react";
import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { drawStreamline, type Pt } from "@/lib/render/draw";
import {
  velocityAt,
  integrateStreamline,
  advectParticle,
  type FieldParams,
  type FlowPoint,
} from "./streamlinesModel";

// A self-consistent pixel-space field: u0 and amplitude are already in px/s so
// all three curves share the same v/u ratio (they coincide in steady flow and
// diverge here because ω ≠ 0). k scaled up for the small card width.
const PARAMS: FieldParams = { u0: 30, amplitude: 26, omega: 2.2, k: 0.05 };
const INJECT_X = 6; // pixel-x of the injection point (left edge)

/**
 * Looping mini view: in an unsteady flapping field the three curves diverge —
 * cyan instantaneous streamline, amber single-particle pathline and a magenta
 * dye streakline trail from a fixed injection point.
 */
export default function StreamlinesPreview() {
  // Persisted trail state across frames.
  const simT = useRef(0);
  const pathline = useRef<FlowPoint[]>([]);
  const dye = useRef<FlowPoint[]>([]);
  const marked = useRef<FlowPoint | null>(null);
  const emit = useRef(0);

  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const cy = height / 2;
    simT.current += dt;
    const t = simT.current;

    // --- instantaneous streamline (cyan), from a fixed left seed ---
    const sl = integrateStreamline({ x: INJECT_X, y: cy }, t, PARAMS, width, 4);
    drawStreamline(
      ctx,
      sl as Pt[],
      dark ? "rgba(34,211,238,0.9)" : "rgba(8,145,178,0.9)",
      2,
    );

    // --- pathline (amber): trajectory of one marked particle ---
    if (!marked.current) marked.current = { x: INJECT_X, y: cy };
    const m = advectParticle(marked.current, t, dt, PARAMS);
    marked.current = m;
    pathline.current.push({ x: m.x, y: m.y });
    if (m.x > width || pathline.current.length > 400) {
      marked.current = { x: INJECT_X, y: cy };
      pathline.current = [];
    }
    if (pathline.current.length > 1) {
      drawStreamline(ctx, pathline.current as Pt[], "rgba(245,158,11,0.95)", 2);
    }

    // --- streakline (magenta): dye released from the injection point ---
    emit.current += dt;
    if (emit.current > 0.04) {
      emit.current = 0;
      dye.current.push({ x: INJECT_X, y: cy });
    }
    for (const d of dye.current) {
      const { vx, vy } = velocityAt(d.x, d.y, t, PARAMS);
      d.x += vx * dt;
      d.y += vy * dt;
    }
    dye.current = dye.current.filter((d) => d.x <= width + 4);
    if (dye.current.length > 1) {
      drawStreamline(ctx, dye.current as Pt[], "rgba(217,70,239,0.95)", 2);
    }

    // Injection point marker.
    ctx.beginPath();
    ctx.arc(INJECT_X, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.fill();
  };

  return <MiniPreview draw={draw} />;
}
