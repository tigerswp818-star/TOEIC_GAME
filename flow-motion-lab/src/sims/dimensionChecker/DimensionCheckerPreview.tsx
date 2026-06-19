import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { approach, clamp } from "@/lib/math";

/** Tilt magnitude (radians) for the unbalanced state. */
const MAX_TILT = 0.22;

let phase = 0;
let tilt = 0;

/**
 * Mini dashboard preview: a balance scale that alternates between LEVEL
 * (a valid / homogeneous equation, green) and TILTED (an invalid one, red)
 * over time — a representative dimensional-homogeneity check.
 */
export default function DimensionCheckerPreview() {
  const draw = ({ ctx, width, height, dt, theme }: DrawContext) => {
    const dark = theme === "dark";
    phase += dt;
    // Alternate every few seconds: balanced (true) → unbalanced → balanced.
    const balanced = Math.sin(phase * 0.6) >= 0;
    const target = balanced ? 0 : MAX_TILT;
    // Ease the tilt toward its target; rate scaled by dt (freezes on pause).
    tilt = approach(tilt, target, clamp(6 * dt, 0, 1));

    const cx = width / 2;
    const pivotY = height * 0.32;
    const beamHalf = width * 0.34;
    const ok = dark ? "#34d399" : "#059669";
    const bad = dark ? "#fb7185" : "#e11d48";
    const accent = balanced ? ok : bad;

    // stand
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY);
    ctx.lineTo(cx, height * 0.86);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.12, height * 0.86);
    ctx.lineTo(cx + width * 0.12, height * 0.86);
    ctx.stroke();

    // fulcrum
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY - 7);
    ctx.lineTo(cx - 7, pivotY + 4);
    ctx.lineTo(cx + 7, pivotY + 4);
    ctx.closePath();
    ctx.fill();

    // tilting beam
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const lx = cx - beamHalf * cos;
    const ly = pivotY - beamHalf * sin;
    const rx = cx + beamHalf * cos;
    const ry = pivotY + beamHalf * sin;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.stroke();

    // pans
    const drop = height * 0.18;
    const panW = width * 0.22;
    const panH = height * 0.16;
    const drawPan = (ax: number, ay: number, label: string) => {
      const px = ax;
      const py = ay + drop;
      ctx.strokeStyle = dark ? "#475569" : "#64748b";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = balanced
        ? dark ? "rgba(16,185,129,0.20)" : "rgba(16,185,129,0.14)"
        : dark ? "rgba(244,63,94,0.20)" : "rgba(244,63,94,0.12)";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(px - panW / 2, py, panW, panH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = "bold 11px 'IBM Plex Sans Thai', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, px, py + panH / 2);
    };
    drawPan(lx, ly, "[M L⁻¹ T⁻²]");
    drawPan(rx, ry, balanced ? "[M L⁻¹ T⁻²]" : "[M L⁻² T⁻²]");

    // verdict mark
    ctx.fillStyle = accent;
    ctx.font = "bold 16px 'IBM Plex Sans Thai', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(balanced ? "✓" : "✗", cx, height * 0.12);
  };

  return <MiniPreview draw={draw} />;
}
