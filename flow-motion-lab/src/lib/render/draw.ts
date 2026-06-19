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
