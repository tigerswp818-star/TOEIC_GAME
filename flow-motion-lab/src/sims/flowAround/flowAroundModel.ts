/**
 * Model for the "Flow Around Object" simulation: fluid streaming left→right past
 * a bluff body. The hero physics is the classic analytic **potential flow around
 * a circular cylinder** (no circulation), which produces beautiful streamlines
 * that bend around the body and accelerate over its top & bottom.
 *
 * In the cylinder frame, with free-stream speed U and radius R, the velocity in
 * polar coordinates (r, θ) measured from the cylinder centre is:
 *   v_r =  U cosθ (1 − R²/r²)
 *   v_θ = −U sinθ (1 + R²/r²)
 * We convert that to Cartesian (vx, vy) so particles can be advected directly.
 *
 * The same field drives all three drawn shapes (circle / plate / airfoil) so the
 * motion stays stable and pretty; only the drawn body outline and the wake
 * direction change with shape + angle of attack. Pure functions + light particle
 * state, no side effects.
 */
import { clamp, smoothstep } from "@/lib/math";

export type ShapeKind = "circle" | "plate" | "airfoil";

/** A tracer particle advected by the velocity field, in pixel space. */
export interface Tracer {
  x: number;
  y: number;
  /** Per-particle random phase so wake jitter looks uncorrelated. */
  seed: number;
}

/** A velocity sample: components in px/s-ish field units plus its magnitude. */
export interface Velocity {
  vx: number;
  vy: number;
  speed: number;
}

/**
 * Potential-flow velocity at world point (x, y) for a cylinder of radius R
 * centred at (cx, cy) in a free stream U flowing in +x.
 *
 * Returns the free-stream (U, 0) when the point is on/inside the cylinder
 * (r ≤ R) — the body interior is excluded from advection anyway, and this keeps
 * the result finite (guards the R²/r² terms against r → 0).
 */
export function velocityAt(
  x: number,
  y: number,
  cx: number,
  cy: number,
  R: number,
  U: number,
): Velocity {
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
export function insideBody(
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
 * Speed of the flow right at the "shoulder" of the cylinder (θ = 90°, r = R),
 * where potential flow is fastest: |v| = 2U. Used for the "max speed over the
 * body" read-out and the over-speed challenge.
 */
export function maxSpeedOverBody(U: number): number {
  return 2 * Math.abs(U);
}

/**
 * Dimensionless wake intensity in roughly [0, 1.6]. Bigger & more chaotic as the
 * free-stream U rises and the viscosity μ falls — the wake of a real bluff body
 * grows with Reynolds number (~ U/μ). A smoothstep keeps it tame at low speed
 * then lets it creep up with a gentle log tail so very fast flow looks wilder.
 */
export function wakeIntensity(U: number, mu: number): number {
  const ratio = Math.abs(U) / Math.max(mu, 1e-4); // ~ Reynolds-like number
  const base = smoothstep(50, 1500, ratio); // 0 → 1 across a sensible band
  const extra = ratio > 1500 ? Math.log10(ratio / 1500) * 0.5 : 0;
  return clamp(base + extra, 0, 1.6);
}

/**
 * Relative drag indicator (arbitrary units, NOT SI). Grows with ρ·U²·R like a
 * real drag force, and is amplified by the wake size so a fat turbulent wake
 * clearly "costs more". Streamlined shapes get a lower coefficient.
 */
export function relativeDrag(
  U: number,
  Rfrac: number,
  rho: number,
  shape: ShapeKind,
  wake: number,
): number {
  // Crude shape drag coefficients — circle (bluff) high, airfoil (streamlined) low.
  const cd = shape === "airfoil" ? 0.18 : shape === "plate" ? 1.0 : 0.6;
  const base = 0.5 * rho * U * U * (Rfrac * 100) * cd; // arbitrary scaling
  return base * (1 + 0.6 * wake);
}

/** Bernoulli pressure coefficient from a local speed and the free-stream U. */
export function pressureCoefficient(speed: number, U: number): number {
  const u = Math.max(Math.abs(U), 1e-6);
  return 1 - (speed / u) * (speed / u);
}

/** Seed a fresh set of tracers spread across the canvas (normalised → pixels). */
export function seedTracers(count: number, width: number, height: number): Tracer[] {
  const out: Tracer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * width,
      y: Math.random() * height,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}
