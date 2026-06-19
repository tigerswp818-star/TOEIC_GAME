/**
 * Model for the Moody-chart simulation: the Darcy friction factor f as a
 * function of Reynolds number Re and relative roughness ε/D.
 *
 * Pure functions, no side effects. Used both to drive the interactive Moody
 * chart (SVG curves + moving marker) and the secondary particle pipe whose
 * chaos / wall roughness reflect the current operating point.
 */
import { clamp, lerp } from "@/lib/math";
import { REYNOLDS_LAMINAR_MAX, REYNOLDS_TURBULENT_MIN } from "@/lib/constants";

/** Guarded base-10 log: never feeds a non-positive value to Math.log10. */
const safeLog10 = (x: number): number => Math.log10(Math.max(x, 1e-12));

/**
 * Turbulent Darcy friction factor via the explicit Swamee–Jain correlation:
 *   f = 0.25 / ( log10( ε/D / 3.7 + 5.74 / Re^0.9 ) )²
 * Valid roughly for 4000 ≤ Re ≤ 1e8 and 1e-6 ≤ ε/D ≤ 0.05.
 */
export function swameeJain(re: number, epsD: number): number {
  const reSafe = Math.max(re, 1);
  const inner = epsD / 3.7 + 5.74 / Math.pow(reSafe, 0.9);
  const denom = safeLog10(inner);
  return 0.25 / (denom * denom);
}

/** Laminar Darcy friction factor: f = 64 / Re. */
export function laminarFriction(re: number): number {
  return 64 / Math.max(re, 1);
}

/**
 * Darcy friction factor f(Re, ε/D), continuous across the whole range:
 *  - laminar (Re < 2000):        f = 64 / Re
 *  - turbulent (Re ≥ 4000):      Swamee–Jain explicit
 *  - transitional (2000–4000):   linear interpolation between the laminar value
 *    at 2000 and the turbulent value at 4000 (so the curve is continuous).
 */
export function frictionFactor(re: number, epsD: number): number {
  const reSafe = Math.max(re, 1);
  if (reSafe < REYNOLDS_LAMINAR_LOW) return laminarFriction(reSafe);
  if (reSafe >= REYNOLDS_TURBULENT_MIN) return swameeJain(reSafe, epsD);
  const fLam = laminarFriction(REYNOLDS_LAMINAR_LOW);
  const fTurb = swameeJain(REYNOLDS_TURBULENT_MIN, epsD);
  const t = (reSafe - REYNOLDS_LAMINAR_LOW) / (REYNOLDS_TURBULENT_MIN - REYNOLDS_LAMINAR_LOW);
  return lerp(fLam, fTurb, clamp(t, 0, 1));
}

/** Lower edge of the transitional band used by the Moody model (Re = 2000). */
export const REYNOLDS_LAMINAR_LOW = 2000;

/** Three-way regime label, reusing the lab's pipe-flow thresholds. */
export type MoodyRegime = "laminar" | "transitional" | "turbulent";

export function moodyRegime(re: number): MoodyRegime {
  if (re < REYNOLDS_LAMINAR_MAX) return "laminar";
  if (re <= REYNOLDS_TURBULENT_MIN) return "transitional";
  return "turbulent";
}

/** A single (Re, f) sample on a Moody curve. */
export interface CurvePoint {
  re: number;
  f: number;
}

/**
 * Generate a curve of f over a logarithmic Re range for a fixed ε/D.
 * Samples are spaced evenly in log10(Re) so the curve looks smooth on the
 * log–log Moody chart.
 */
export function frictionCurve(
  epsD: number,
  reMin: number,
  reMax: number,
  samples = 80,
): CurvePoint[] {
  const lo = safeLog10(Math.max(reMin, 1));
  const hi = safeLog10(Math.max(reMax, reMin + 1));
  const out: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const re = Math.pow(10, lerp(lo, hi, i / samples));
    out.push({ re, f: frictionFactor(re, epsD) });
  }
  return out;
}

/** The pure-laminar reference line (64/Re) sampled across a Re range. */
export function laminarCurve(reMin: number, reMax: number, samples = 40): CurvePoint[] {
  const lo = safeLog10(Math.max(reMin, 1));
  const hi = safeLog10(Math.max(reMax, reMin + 1));
  const out: CurvePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const re = Math.pow(10, lerp(lo, hi, i / samples));
    out.push({ re, f: laminarFriction(re) });
  }
  return out;
}

/** The ε/D values whose turbulent curves are drawn on the chart. */
export const ROUGHNESS_CURVES = [0, 0.0001, 0.001, 0.005, 0.01, 0.03, 0.05] as const;

/**
 * "Chaos" intensity in roughly [0, 1.4] that drives the secondary particle
 * pipe: 0 while laminar, ramping through the transitional band and creeping up
 * with log(Re) once turbulent (clamped so the animation stays bounded).
 */
export function chaosIntensity(re: number): number {
  if (re <= REYNOLDS_LAMINAR_MAX) return 0;
  if (re <= REYNOLDS_TURBULENT_MIN) {
    return (re - REYNOLDS_LAMINAR_MAX) / (REYNOLDS_TURBULENT_MIN - REYNOLDS_LAMINAR_MAX);
  }
  const extra = safeLog10(re / REYNOLDS_TURBULENT_MIN) * 0.5;
  return clamp(1 + extra, 0, 1.4);
}

/** A particle flowing left→right along the secondary rough pipe. */
export interface PipeParticle {
  /** Normalised horizontal position 0→1. */
  xf: number;
  /** Streamline fraction in [-0.85, 0.85] (share of pipe half-height). */
  f: number;
  /** Per-particle random phase so jitter looks uncorrelated. */
  seed: number;
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): PipeParticle[] {
  const out: PipeParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      f: (Math.random() * 2 - 1) * 0.85,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}
