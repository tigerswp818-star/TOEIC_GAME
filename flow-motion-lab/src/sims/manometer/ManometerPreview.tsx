import MiniPreview from "@/components/sim/MiniPreview";
import type { DrawContext } from "@/components/canvas/ParticleFlowCanvas";

/** Looping mini view of a U-tube whose two columns gently oscillate. */
export default function ManometerPreview() {
  const draw = ({ ctx, width, height, time, theme }: DrawContext) => {
    const dark = theme === "dark";
    const tubeW = Math.min(width * 0.16, 34);
    const halfW = tubeW / 2;
    const leftX = width * 0.32;
    const rightX = width * 0.68;
    const topY = height * 0.12;
    const bottomY = height * 0.86;
    const bendR = tubeW * 0.9;
    const midY = topY + (bottomY - bendR - topY) * 0.45;

    // gently oscillating level difference (unequal columns)
    const disp = (bottomY - bendR - topY) * 0.22 * (0.6 + 0.4 * Math.sin(time * 1.1));
    const leftLevelY = midY + disp;
    const rightLevelY = midY - disp;

    // glass tube outline
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(leftX - halfW, topY);
    ctx.lineTo(leftX - halfW, bottomY - bendR);
    ctx.quadraticCurveTo(leftX - halfW, bottomY, leftX - halfW + bendR, bottomY);
    ctx.lineTo(rightX + halfW - bendR, bottomY);
    ctx.quadraticCurveTo(rightX + halfW, bottomY, rightX + halfW, bottomY - bendR);
    ctx.lineTo(rightX + halfW, topY);
    ctx.stroke();

    // fluid fill, clipped to the columns + bottom connector
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftX - halfW, topY, tubeW, bottomY - topY);
    ctx.rect(rightX - halfW, topY, tubeW, bottomY - topY);
    ctx.rect(leftX - halfW, bottomY - bendR, rightX - leftX + tubeW, bendR);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, topY, 0, bottomY);
    grad.addColorStop(0, dark ? "rgba(56,189,248,0.55)" : "rgba(125,211,252,0.75)");
    grad.addColorStop(1, dark ? "rgba(12,41,84,0.8)" : "rgba(59,130,246,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(leftX - halfW, leftLevelY, tubeW, bottomY - leftLevelY);
    ctx.fillRect(rightX - halfW, rightLevelY, tubeW, bottomY - rightLevelY);
    ctx.fillRect(leftX - halfW, bottomY - bendR, rightX - leftX + tubeW, bendR);
    ctx.restore();

    // surface lines
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.9)" : "rgba(37,99,235,0.75)";
    ctx.beginPath();
    ctx.moveTo(leftX - halfW, leftLevelY);
    ctx.lineTo(leftX + halfW, leftLevelY);
    ctx.moveTo(rightX - halfW, rightLevelY);
    ctx.lineTo(rightX + halfW, rightLevelY);
    ctx.stroke();
  };

  return <MiniPreview draw={draw} />;
}
