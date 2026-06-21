/**
 * Reusable canvas drawing primitives shared by every simulation:
 * velocity-vector arrows, streamlines, rounded panels and labels.
 *
 * These back the conceptual layers the brief calls out
 * (VelocityVectorOverlay → drawArrow, StreamlineRenderer → drawStreamline).
 */

export interface Pt {
  x: number;
  y: number;
}

/** Draw an arrow from (x1,y1) to (x2,y2) with a proportional head. */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
  headSize = 8,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const h = Math.min(headSize, Math.hypot(x2 - x1, y2 - y1));
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - h * Math.cos(angle - Math.PI / 6),
    y2 - h * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - h * Math.cos(angle + Math.PI / 6),
    y2 - h * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw a horizontal velocity vector whose length encodes speed. */
export function drawVelocityVector(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  speed: number,
  pxPerUnit: number,
  color: string,
): void {
  const len = Math.max(6, speed * pxPerUnit);
  drawArrow(ctx, x, y, x + len, y, color, 2.5, 9);
}

/** Smooth a poly-line through points and stroke it (Catmull-Rom-ish). */
export function drawStreamline(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  color: string,
  width = 1.5,
  dash: number[] | null = null,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Soft radial highlight — used to glow key points (Venturi throat, vortex core,
 * low-pressure spots). `rgb` is a "r, g, b" channel string.
 */
export function softGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha = 0.5,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A fluid particle drawn with a velocity-aligned motion trail and optional
 * glow. `(ux,uy)` is the unit direction of motion; `trail` is the trail length
 * in px (longer = faster). `rgb` is a "r, g, b" channel string.
 */
export function drawFlowParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ux: number,
  uy: number,
  rgb: string,
  opts: { radius?: number; trail?: number; alpha?: number; glow?: boolean } = {},
): void {
  const { radius = 2.4, trail = 0, alpha = 0.95, glow = false } = opts;
  if (trail > 1.5) {
    const tx = x - ux * trail;
    const ty = y - uy * trail;
    const g = ctx.createLinearGradient(tx, ty, x, y);
    g.addColorStop(0, `rgba(${rgb}, 0)`);
    g.addColorStop(1, `rgba(${rgb}, ${alpha * 0.5})`);
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = radius * 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }
  if (glow) softGlow(ctx, x, y, radius * 3.2, rgb, alpha * 0.3);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
  ctx.fill();
}

/** A 0→1 pulsing value for highlighting key concepts (period in seconds). */
export const pulse = (time: number, period = 2): number =>
  0.5 + 0.5 * Math.sin((time / period) * Math.PI * 2);

/** A filled, optionally stroked rounded rectangle. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Draw a small text label with a translucent backing pill. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color?: string; bg?: string; align?: CanvasTextAlign; font?: string } = {},
): void {
  const { color = "#e2e8f0", bg = "rgba(8,13,24,0.7)", align = "left", font = "12px 'IBM Plex Sans Thai', sans-serif" } = opts;
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width;
  const padX = 6;
  const padY = 4;
  let bx = x - padX;
  if (align === "center") bx = x - w / 2 - padX;
  if (align === "right") bx = x - w - padX;
  ctx.fillStyle = bg;
  roundRect(ctx, bx, y - 9 - padY, w + padX * 2, 18 + padY, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
