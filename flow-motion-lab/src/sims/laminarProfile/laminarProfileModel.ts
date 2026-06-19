/**
 * Physics + particle model for the Laminar Velocity Profile simulation
 * (fully-developed Hagen–Poiseuille flow in a round pipe).
 *
 * The velocity profile is parabolic: u(r) = u_max·(1 − (r/R)²), zero at the wall
 * (no-slip) and maximal at the centre. Pure functions, SI units, guarded against
 * non-physical input so a mid-drag slider value can never produce NaN/Infinity.
 */

/** Guard a value to be strictly positive (avoids divide-by-zero / NaN). */
const positive = (v: number, min = 1e-9): number =>
  Number.isFinite(v) && v > min ? v : min;

/**
 * Local axial velocity at radius r in a pipe of radius R with centreline speed
 * u_max:  u(r) = u_max·(1 − (r/R)²).  Returns 0 outside the wall (|r| ≥ R).
 */
export function velocityProfile(r: number, R: number, umax: number): number {
  const rad = positive(R);
  const ratio = Math.abs(r) / rad;
  if (ratio >= 1) return 0;
  return umax * (1 - ratio * ratio);
}

/**
 * Centreline (maximum) velocity from the pressure gradient:
 * u_max = (ΔP/L)·R² / (4μ)  (m/s).
 */
export function uMax(dpdx: number, R: number, mu: number): number {
  const rad = positive(R);
  return (Math.max(dpdx, 0) * rad * rad) / (4 * positive(mu));
}

/**
 * Volumetric flow rate (Hagen–Poiseuille):
 * Q = (π·(ΔP/L)·R⁴) / (8μ)  (m³/s).
 */
export function flowRate(dpdx: number, R: number, mu: number): number {
  const rad = positive(R);
  return (Math.PI * Math.max(dpdx, 0) * rad ** 4) / (8 * positive(mu));
}

/** Mean (average) velocity over the cross-section = u_max / 2  (m/s). */
export function meanVelocity(umax: number): number {
  return umax / 2;
}

/** A particle flowing left→right in a horizontal layer of the pipe. */
export interface LayerParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Radial fraction in [-1, 1] (share of pipe radius; 0 = centre, ±1 = wall). */
  rf: number;
}

/**
 * Seed a fresh set of particles spread across the pipe. Radial positions are
 * spread across full [-1, 1] so the parabolic speed difference is visible.
 */
export function seedParticles(count: number): LayerParticle[] {
  const out: LayerParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), rf: Math.random() * 2 - 1 });
  }
  return out;
}
