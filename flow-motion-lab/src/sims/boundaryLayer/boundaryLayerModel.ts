/**
 * Physics + particle model for the Flat Plate Boundary Layer simulation.
 *
 * Flow runs left→right over a flat plate. A boundary layer grows from the
 * leading edge: thin and laminar near the front (Blasius), thickening faster
 * once the local Reynolds number Re_x crosses the transition value and the flow
 * turns turbulent. All physics lives here — the sim/preview only render it.
 */
import { clamp } from "@/lib/math";

/** Local Reynolds number based on distance x from the leading edge. */
export function reynoldsX(rho: number, U: number, x: number, mu: number): number {
  return (rho * U * Math.max(x, 0)) / Math.max(mu, 1e-9);
}

/** Reynolds number at which a flat-plate boundary layer goes turbulent. */
export const RE_TRANSITION = 5e5;

/**
 * Laminar (Blasius) boundary-layer thickness: δ = 5x / √(Re_x).
 * Returns metres. Guards Re_x = 0 at the leading edge (δ → 0).
 */
export function deltaLaminar(x: number, reX: number): number {
  if (reX <= 0) return 0;
  return (5 * Math.max(x, 0)) / Math.sqrt(reX);
}

/**
 * Turbulent boundary-layer thickness: δ ≈ 0.37x / Re_x^0.2.
 * Returns metres. Grows noticeably faster with x than the laminar form.
 */
export function deltaTurbulent(x: number, reX: number): number {
  if (reX <= 0) return 0;
  return (0.37 * Math.max(x, 0)) / Math.pow(reX, 0.2);
}

/** Is the boundary layer turbulent at this station (Re_x ≥ ~5×10⁵)? */
export function isTurbulent(reX: number): boolean {
  return reX >= RE_TRANSITION;
}

/**
 * Boundary-layer thickness δ(x) choosing the correct regime from Re_x.
 * Laminar below the transition, turbulent above it.
 */
export function deltaAt(x: number, rho: number, U: number, mu: number): number {
  const reX = reynoldsX(rho, U, x, mu);
  return isTurbulent(reX) ? deltaTurbulent(x, reX) : deltaLaminar(x, reX);
}

/** Distance x (m) at which the flow transitions, given U, ρ, μ. */
export function transitionX(rho: number, U: number, mu: number): number {
  return (RE_TRANSITION * Math.max(mu, 1e-9)) / Math.max(rho * U, 1e-9);
}

/**
 * Normalised velocity u(y)/U at height y above the plate, given the local
 * boundary-layer thickness δ. No-slip at the wall (u = 0 at y = 0) rising to
 * the free stream (u → U) at the edge of δ and above.
 *
 *  - Laminar: a smooth (≈ Blasius) profile, here a sin-shaped approximation.
 *  - Turbulent: a fuller 1/7-power-law profile (steeper near the wall).
 */
export function velocityRatio(y: number, delta: number, turbulent: boolean): number {
  if (delta <= 0) return 1;
  const eta = clamp(y / delta, 0, 1);
  if (y >= delta) return 1;
  if (turbulent) {
    // 1/7-power law: u/U = (y/δ)^(1/7)
    return Math.pow(eta, 1 / 7);
  }
  // Smooth laminar approximation: u/U = sin(π/2 · η) — 0 at wall, 1 at edge.
  return Math.sin((Math.PI / 2) * eta);
}

/** Absolute local velocity u(y) in m/s. */
export function velocityAt(
  y: number,
  delta: number,
  U: number,
  turbulent: boolean,
): number {
  return U * velocityRatio(y, delta, turbulent);
}

/** A flowing fluid particle over the plate. */
export interface FlowParticle {
  /** Normalised horizontal position 0→1 across the plate. */
  xf: number;
  /** Height above the plate in metres. */
  y: number;
}

/**
 * Seed particles spread across the plate. Heights are distributed up to a
 * given domain height (m) so some sit inside the boundary layer (and lag) and
 * some ride in the free stream above it.
 */
export function seedParticles(count: number, domainHeight: number): FlowParticle[] {
  const out: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), y: Math.random() * domainHeight });
  }
  return out;
}
