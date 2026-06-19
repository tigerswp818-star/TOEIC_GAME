/**
 * Model for the Circulation simulation (Fluid Kinematics — Vortex chapter).
 *
 * Circulation is the line integral of velocity around a closed loop:
 *
 *   Γ = ∮ V·dl
 *
 * Two vortex kinds drive the velocity field, both centred at the vortex origin:
 *
 *   free   (irrotational): vθ = K / r          (K = strength / 2π)
 *   forced (solid body):   vθ = ω·r            (ω = strength)
 *
 * Teaching points the numbers must reproduce:
 *   • Free vortex: Γ is the SAME for any loop that encloses the centre
 *     (Γ = 2πK = strength) and ZERO for any loop that does not enclose it.
 *   • Forced vortex: Γ grows with the ENCLOSED AREA — by Stokes' theorem,
 *     Γ = ∬ ω_z dA = (2ω)·Area, so Γ = 2·strength·π·R² for a circle of radius R.
 *
 * Pure functions only — no side effects. Guards r → 0 everywhere.
 */

/** The two vortex kinds the learner can pick. */
export type VortexKind = "free" | "forced";

/** Field parameters. `strength` is Γ-ish for free, ω for forced. */
export interface VortexParams {
  /** Vortex strength: Γ-circulation for free, angular velocity ω for forced. */
  strength: number;
}

/** A 2-D velocity sample (field units). */
export interface Velocity {
  vx: number;
  vy: number;
}

/** Avoid the singular centre of a free vortex. */
const R_FLOOR = 1e-3;

/**
 * Local velocity of the chosen vortex at point (x, y), with the vortex centre
 * at the origin. The tangential (counter-clockwise) unit vector is (-y/r, x/r).
 *
 * free:   vθ = strength / (2π r)   → 1/r falloff, irrotational outside r = 0
 * forced: vθ = strength · r         → solid-body rotation (finite everywhere)
 */
export function velocityAt(
  x: number,
  y: number,
  kind: VortexKind,
  params: VortexParams,
): Velocity {
  const { strength } = params;
  const r = Math.hypot(x, y);
  if (kind === "forced") {
    // Solid body: vx = -ω·y, vy = ω·x  (no singularity at the centre).
    return { vx: -strength * y, vy: strength * x };
  }
  // Free / potential vortex — guard the singular core.
  if (r < R_FLOOR) return { vx: 0, vy: 0 };
  const vTheta = strength / (2 * Math.PI * r);
  return { vx: (-y / r) * vTheta, vy: (x / r) * vTheta };
}

/**
 * Numerically integrate Γ = ∮ V·dl around a circle of radius R centred at
 * (cx, cy), using the velocity field of the chosen vortex (vortex centre at the
 * origin). Returns the circulation in field units (m²/s).
 *
 * The loop is parameterised by angle θ; the tangent (CCW) at a point on the
 * circle is dl = (-sin θ, cos θ)·R dθ. Summing V·dl over a fine partition gives
 * the circulation. Higher `steps` → more accurate; the default is plenty.
 */
export function circulationAroundCircle(
  cx: number,
  cy: number,
  R: number,
  kind: VortexKind,
  params: VortexParams,
  steps = 720,
): number {
  const radius = Math.max(R, R_FLOOR);
  const n = Math.max(8, Math.floor(steps));
  const dTheta = (2 * Math.PI) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    // Midpoint of each angular segment for a cleaner Riemann sum.
    const theta = (i + 0.5) * dTheta;
    const px = cx + radius * Math.cos(theta);
    const py = cy + radius * Math.sin(theta);
    const v = velocityAt(px, py, kind, params);
    // dl = (-sin θ, cos θ) · R dθ  (counter-clockwise tangent).
    const dlx = -Math.sin(theta) * radius * dTheta;
    const dly = Math.cos(theta) * radius * dTheta;
    sum += v.vx * dlx + v.vy * dly;
  }
  return sum;
}

/** Does a loop of radius R centred at (cx, cy) enclose the vortex centre (origin)? */
export function enclosesCentre(cx: number, cy: number, R: number): boolean {
  return Math.hypot(cx, cy) < R;
}

/**
 * Closed-form circulation for reference / graphing (matches the numeric
 * integral when the loop encloses or excludes the centre cleanly):
 *
 *   free, enclosing:   Γ = strength      (independent of R and area)
 *   free, not enclosing: Γ = 0
 *   forced:            Γ = 2·strength·π·R²   (= 2ω · area, by Stokes)
 *
 * Used for the analytic LineChart curve of Γ vs loop radius R.
 */
export function analyticCirculation(
  R: number,
  kind: VortexKind,
  params: VortexParams,
  encloses = true,
): number {
  const { strength } = params;
  if (kind === "forced") {
    return 2 * strength * Math.PI * R * R; // Γ = 2ω · πR²
  }
  return encloses ? strength : 0; // free vortex
}

/** A particle orbiting the vortex centre at a fixed radius fraction. */
export interface OrbitParticle {
  /** Radius from centre as a fraction of the view half-extent, in [0.06, 0.95]. */
  rf: number;
  /** Current orbital angle (rad). */
  angle: number;
}

/** Seed orbiting particles spread over the view, biased for uniform density. */
export function seedParticles(count: number): OrbitParticle[] {
  const out: OrbitParticle[] = [];
  for (let i = 0; i < count; i++) {
    // sqrt keeps spatial density roughly uniform over the disc area.
    const rf = Math.min(0.95, Math.max(0.06, Math.sqrt(Math.random()) * 0.92 + 0.06));
    out.push({ rf, angle: Math.random() * Math.PI * 2 });
  }
  return out;
}
