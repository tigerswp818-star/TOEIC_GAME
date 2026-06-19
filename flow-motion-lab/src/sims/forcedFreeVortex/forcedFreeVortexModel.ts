/**
 * Model for the "Forced vs Free Vortex" simulation — two idealised vortex types
 * shown top-down (particles orbiting) plus a side-view of the free surface.
 *
 *  FORCED vortex (rotating tank, solid-body):
 *    vθ(r) = ω·r            — speed rises outward (rigid-body rotation)
 *    z(r)  = z0 + ω²r²/(2g) — free surface is a PARABOLA rising outward
 *
 *  FREE vortex (irrotational drain/bathtub):
 *    vθ(r) = C/r            — speed rises toward the centre (fast near core)
 *    z(r)  = z0 − C²/(2g r²) — free surface DIPS into a central funnel
 *
 * Pure functions + lightweight particle state, no side effects. The free
 * vortex is singular at r→0, so vθ and z are guarded by capping the radius.
 */
import { clamp } from "@/lib/math";
import { GRAVITY } from "@/lib/constants";

/** Which idealised vortex is active. */
export type VortexKind = "forced" | "free";

/** Live parameters read by the model. */
export interface VortexParams {
  /** Angular velocity ω (rad/s) — used when kind === "forced". */
  omega: number;
  /** Circulation constant C (m²/s) — used when kind === "free". */
  circulation: number;
}

/**
 * Minimum radius (m) used to evaluate the free vortex near the centre. Caps the
 * 1/r singularity so vθ and the funnel depth stay finite and drawable.
 */
export const FREE_CORE_MIN = 0.18;

/**
 * Tangential speed vθ at radius r (m) for the active vortex kind. Returns m/s.
 * Forced: vθ = ω·r (linear, fastest outward).
 * Free:   vθ = C/r (1/r, fastest near the centre; r capped at FREE_CORE_MIN).
 */
export function tangentialSpeed(r: number, kind: VortexKind, params: VortexParams): number {
  if (kind === "forced") return params.omega * Math.max(r, 0);
  const rr = Math.max(r, FREE_CORE_MIN); // guard r→0 for the free vortex
  return params.circulation / rr;
}

/**
 * Angular speed ω(r) = vθ(r)/r — what advances a particle's orbital angle each
 * frame. Constant (= ω) for forced; falls as 1/r² for free (very fast near core).
 */
export function angularSpeed(r: number, kind: VortexKind, params: VortexParams): number {
  if (kind === "forced") return params.omega;
  const rr = Math.max(r, FREE_CORE_MIN);
  return tangentialSpeed(rr, kind, params) / rr;
}

/**
 * Free-surface height z (m) relative to a reference z0, at radius r (m).
 * Forced: z = z0 + ω²r²/(2g) — parabola rising outward.
 * Free:   z = z0 − C²/(2g r²) — funnel dipping at the centre (r capped).
 */
export function surfaceHeight(
  r: number,
  kind: VortexKind,
  params: VortexParams,
  z0 = 0,
): number {
  if (kind === "forced") {
    const w = params.omega;
    return z0 + (w * w * r * r) / (2 * GRAVITY);
  }
  const rr = Math.max(r, FREE_CORE_MIN);
  const c = params.circulation;
  return z0 - (c * c) / (2 * GRAVITY * rr * rr);
}

/** A particle orbiting the vortex centre at (roughly) fixed radius. */
export interface VortexParticle {
  /** Radius from centre as a fraction of tank radius, in [0.04, 0.99]. */
  rf: number;
  /** Current angle (rad), advanced each frame by the local angular speed. */
  angle: number;
}

/** Seed particles spread over the disc (sqrt keeps spatial density ~uniform). */
export function seedParticles(count: number): VortexParticle[] {
  const out: VortexParticle[] = [];
  for (let i = 0; i < count; i++) {
    const rf = clamp(Math.sqrt(Math.random()) * 0.95 + 0.04, 0.04, 0.99);
    out.push({ rf, angle: Math.random() * Math.PI * 2 });
  }
  return out;
}

/**
 * Peak tangential speed over the tank for colour normalisation. Forced peaks at
 * the outer edge (r = tank); free peaks at the capped inner radius.
 */
export function peakSpeed(kind: VortexKind, params: VortexParams, tank: number): number {
  if (kind === "forced") return tangentialSpeed(tank, kind, params);
  return tangentialSpeed(FREE_CORE_MIN, kind, params);
}
