import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { junctionGeometry, branchPoint, type Branch } from "./pipeJunctionModel";
import { velocityColor } from "@/lib/colors";

const Q_IN = 0.5;
const Q_OUT1 = 0.3;
const Q_OUT2 = 0.2;
const SPEED = 0.5;

interface PreviewParticle {
  s: number;
  branch: Branch;
  off: number;
}

const particles: PreviewParticle[] = Array.from({ length: 48 }, () => ({
  s: Math.random(),
  branch: "in" as Branch,
  off: (Math.random() * 2 - 1) * 0.75,
}));

/** Looping mini view of a Y junction splitting flow to two outlets. */
export default function PipeJunctionPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    const g = junctionGeometry(width, height);
    const pipeR = Math.max(5, Math.min(width, height) * 0.06);
    const maxQ = Math.max(Q_IN, Q_OUT1, Q_OUT2);
    const share1 = Q_OUT1 / (Q_OUT1 + Q_OUT2);

    // pipe walls (inlet + two outlets)
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const [ax, ay, bx, by] of [
      [g.inX, g.inY, g.jx, g.jy],
      [g.jx, g.jy, g.o1X, g.o1Y],
      [g.jx, g.jy, g.o2X, g.o2Y],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // junction node
    ctx.beginPath();
    ctx.arc(g.jx, g.jy, pipeR * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0e7490" : "#67e8f9";
    ctx.fill();

    for (const p of particles) {
      const spd =
        p.branch === "in" ? Q_IN : p.branch === "out1" ? Q_OUT1 : Q_OUT2;
      p.s += (spd / 0.1) * SPEED * 0.12 * dt;
      if (p.s >= 1) {
        if (p.branch === "in") {
          p.branch = Math.random() < share1 ? "out1" : "out2";
        } else {
          p.branch = "in";
        }
        p.s = 0;
        p.off = (Math.random() * 2 - 1) * 0.75;
      }
      const pt = branchPoint(p.branch, p.s, g);
      const qBranch =
        p.branch === "in" ? Q_IN : p.branch === "out1" ? Q_OUT1 : Q_OUT2;
      ctx.beginPath();
      ctx.arc(pt.x + pt.nx * pipeR * p.off, pt.y + pt.ny * pipeR * p.off, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(Math.min(1, qBranch / maxQ), 0.95);
      ctx.fill();
    }
  };

  return <MiniPreview draw={draw} />;
}
