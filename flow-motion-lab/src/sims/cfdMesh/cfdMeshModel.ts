/**
 * Model for the "CFD Mesh Concept Viewer" simulation.
 *
 * The idea: CFD (Computational Fluid Dynamics) cannot solve the smooth,
 * continuous flow field directly — it chops the domain into a finite **mesh** of
 * N×N cells and solves the governing equations numerically inside each cell. A
 * COARSE mesh (few large cells) gives a blocky, low-resolution picture, while a
 * FINE mesh (many small cells) approximates the true flow much better… at the
 * cost of far more computation (cost ∝ number of cells ∝ N²).
 *
 * The "true" flow used here is the classic analytic **potential flow around a
 * circular cylinder** (same field family as the Flow-Around sim) so we have a
 * smooth reference to discretise against. Pure functions + light particle state,
 * no side effects.
 */
import { clamp, smoothstep } from "@/lib/math";

/** A drifting reference tracer (the smooth "true" flow), in pixel space. */
export interface MeshTracer {
  x: number;
  y: number;
  /** Per-particle random phase for uncorrelated recycling. */
  seed: number;
}

/** A velocity sample: components in field units plus its magnitude. */
export interface MeshVelocity {
  vx: number;
  vy: number;
  speed: number;
}

/** The three named mesh density presets exposed via ToggleChips. */
export type MeshLevel = "coarse" | "medium" | "fine";

/** N (cells per side) for each named preset. */
export const MESH_PRESETS: { id: MeshLevel; label: string; icon: string; n: number }[] = [
  { id: "coarse", label: "หยาบ Coarse", icon: "🟦", n: 8 },
  { id: "medium", label: "กลาง Medium", icon: "🔲", n: 16 },
  { id: "fine", label: "ละเอียด Fine", icon: "▦", n: 32 },
];

/** Grid-resolution slider bounds (cells per side). */
export const N_MIN = 6;
export const N_MAX = 48;

/**
 * Analytic potential-flow velocity at world point (x, y) for a cylinder of
 * radius R centred at (cx, cy) in a free stream U flowing in +x. This is the
 * "true" continuous solution the mesh tries to reproduce.
 *
 * Returns the free-stream (U, 0) on/inside the body (r ≤ R) so the result stays
 * finite (guards the R²/r² terms against r → 0).
 */
export function fieldVelocity(
  x: number,
  y: number,
  cx: number,
  cy: number,
  R: number,
  U: number,
): MeshVelocity {
  const dx = x - cx;
  const dy = y - cy;
  const r2 = dx * dx + dy * dy;
  const r = Math.sqrt(r2);
  if (r <= R || r2 < 1e-6) {
    return { vx: U, vy: 0, speed: Math.abs(U) };
  }
  const cos = dx / r;
  const sin = dy / r;
  const ratio = (R * R) / r2; // R²/r²
  const vr = U * cos * (1 - ratio);
  const vt = -U * sin * (1 + ratio);
  // Polar → Cartesian:  v = vr·r̂ + vt·θ̂,  r̂=(cos,sin), θ̂=(−sin,cos)
  const vx = vr * cos - vt * sin;
  const vy = vr * sin + vt * cos;
  return { vx, vy, speed: Math.hypot(vx, vy) };
}

/** True when (x, y) lies inside the cylinder of radius R about (cx, cy). */
export function insideCylinder(
  x: number,
  y: number,
  cx: number,
  cy: number,
  R: number,
): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}

/**
 * Maximum speed in the field — the flow at the cylinder "shoulder" reaches 2U.
 * Used to normalise the cell-shading colour scale so it is stable across U.
 */
export function maxFieldSpeed(U: number): number {
  return 2 * Math.abs(U);
}

/** Total number of cells for an N×N mesh. */
export function cellCount(n: number): number {
  return n * n;
}

/**
 * Relative compute cost (×, dimensionless), normalised so the coarsest preset
 * (N = 8) ≈ 1×. Cost grows with the number of cells (∝ N²): a fine mesh costs
 * dramatically more than a coarse one. A small super-linear bump (N^0.2) nods to
 * the extra solver iterations a finer grid typically needs, but the dominant
 * term is the cell count.
 */
export function relativeCost(n: number): number {
  const base = 8; // reference resolution → 1×
  const cells = (n * n) / (base * base); // the ∝ N² part
  const solver = (n / base) ** 0.2; // gentle super-linear nod to iterations
  return cells * solver;
}

/**
 * Relative discretisation error (%, 100 → fully unresolved, →0 → exact). A
 * coarse mesh smears out the sharp gradients near the body & in the wake, so
 * error is high; refining the mesh drives it down roughly like 1/N (first-order
 * convergence) but never quite to zero — CFD is an approximation. Returned in
 * percent for a friendly read-out / trade-off graph.
 */
export function relativeError(n: number): number {
  // ~ 1/N convergence, scaled so coarse (N≈6–8) reads high and fine reads small.
  const conv = 100 / n; // first-order-ish falloff
  // Floor: even an infinitely fine mesh keeps model/boundary-condition error.
  return clamp(conv + 1.5, 1.5, 100);
}

/**
 * Map an N×N mesh onto its nearest named level for the read-out string.
 * <12 → Coarse, <24 → Medium, otherwise Fine.
 */
export function meshLevelOf(n: number): MeshLevel {
  if (n < 12) return "coarse";
  if (n < 24) return "medium";
  return "fine";
}

/** Thai label for a mesh level. */
export function meshLevelLabel(level: MeshLevel): string {
  switch (level) {
    case "coarse":
      return "หยาบ Coarse";
    case "medium":
      return "กลาง Medium";
    case "fine":
      return "ละเอียด Fine";
  }
}

/**
 * Smooth 0→1 "resolution quality" indicator across the slider range, for any
 * qualitative copy that wants to say how well the mesh resolves the field.
 */
export function resolutionQuality(n: number): number {
  return smoothstep(N_MIN, N_MAX, n);
}

/** Seed reference tracers spread across the canvas (the smooth "true" flow). */
export function seedTracers(count: number, width: number, height: number): MeshTracer[] {
  const out: MeshTracer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * width,
      y: Math.random() * height,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}
