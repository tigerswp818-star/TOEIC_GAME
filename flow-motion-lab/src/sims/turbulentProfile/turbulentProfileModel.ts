/**
 * Physics + particle model for the Turbulent Velocity Profile simulation.
 *
 * Compares a turbulent pipe-flow profile (1/7th power law — nearly flat across
 * the core with a thin steep no-slip layer at the wall) against the laminar
 * parabola u_max·(1 − (r/R)²). Pure functions + lightweight particle state.
 *
 *  - turbulentProfile(r, R, umax, n): u(r) = u_max·(1 − r/R)^(1/n)
 *  - laminarProfile(r, R, umax):      u(r) = u_max·(1 − (r/R)²)
 *  - powerIndex(Re):                  n grows slowly with Re (≈6 → ≈10)
 *  - meanOverMaxTurbulent(n):         mean/u_max ratio for the power law (≈0.8)
 */
import { clamp } from "@/lib/math";

/**
 * Turbulent velocity profile (1/n-th power law) at radial position r.
 *  u(r) = u_max·(1 − r/R)^(1/n)
 * The profile is nearly flat for most of the core and drops steeply to zero at
 * the wall (no-slip). r and R in metres, umax in m/s, n dimensionless (≈7).
 */
export function turbulentProfile(r: number, R: number, umax: number, n: number): number {
  if (R <= 0) return 0;
  const rr = clamp(Math.abs(r) / R, 0, 1);
  return umax * Math.pow(1 - rr, 1 / n);
}

/**
 * Laminar reference profile (parabola) at radial position r for the same u_max.
 *  u(r) = u_max·(1 − (r/R)²)
 */
export function laminarProfile(r: number, R: number, umax: number): number {
  if (R <= 0) return 0;
  const rr = clamp(Math.abs(r) / R, 0, 1);
  return umax * (1 - rr * rr);
}

/**
 * Power-law index n as a function of Reynolds number. Turbulent profiles get
 * "fuller"/flatter as Re rises, which corresponds to a larger n: roughly 6 at
 * the low-turbulent end (~4000) up to ~10 at very high Re (~1e6).
 */
export function powerIndex(Re: number): number {
  const re = Math.max(1, Re);
  // Map log10(Re) over [log10(4000), log10(1e6)] → [6, 10].
  const lo = Math.log10(4000);
  const hi = Math.log10(1e6);
  const t = clamp((Math.log10(re) - lo) / (hi - lo), 0, 1);
  return 6 + t * 4;
}

/**
 * Mean-to-max velocity ratio for the 1/n power-law profile in a round pipe:
 *  mean/u_max = 2n² / [(n + 1)(2n + 1)]
 * Gives ≈0.8 for n = 7 (versus 0.5 for the laminar parabola).
 */
export function meanOverMaxTurbulent(n: number): number {
  return (2 * n * n) / ((n + 1) * (2 * n + 1));
}

/** Mean-to-max velocity ratio for the laminar parabola — always exactly 0.5. */
export const LAMINAR_MEAN_OVER_MAX = 0.5;

/** A particle flowing left→right inside one radial layer of the pipe. */
export interface ProfileParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Radial fraction in [-1, 1] (share of pipe radius R; 0 = centreline). */
  rf: number;
  /** Per-particle random phase so the turbulent jitter looks uncorrelated. */
  seed: number;
}

/** Seed a fresh set of particles spread across the pipe radius. */
export function seedParticles(count: number): ProfileParticle[] {
  const out: ProfileParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      rf: Math.random() * 2 - 1,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}
