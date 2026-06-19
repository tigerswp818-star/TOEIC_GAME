/**
 * Physics + particle model for the "Nozzle Reaction Force" simulation.
 *
 * A converging nozzle accelerates an incompressible fluid from a wide inlet
 * (D₁) to a narrow outlet (D₂). By continuity the outlet velocity rises:
 *
 *   A₁ = circleArea(D₁)                inlet area                (m²)
 *   A₂ = circleArea(D₂)                outlet area               (m²)
 *   Q  = A₁·V₁                         volumetric flow rate      (m³/s)
 *   V₂ = V₁·A₁ / A₂                    outlet velocity           (m/s)
 *
 * A control-volume momentum balance (free jet → P₂ = 0 gauge) gives the
 * reaction force the nozzle body must resist:
 *
 *   R  = ρ·Q·(V₂ − V₁) + P₁·A₁         reaction force magnitude  (N)
 *
 * The momentum term ρ·Q·(V₂ − V₁) is the rate of change of momentum as the
 * fluid speeds up; P₁·A₁ is the pressure thrust on the inlet face. The force
 * points BACKWARD on the nozzle (opposite the jet) — like a fire hose kicking
 * back. All formulas are pure, SI units, and guard against non-physical input
 * (areas > 0, D₂ < D₁) so a mid-drag slider value can never yield NaN/Infinity.
 */
import { circleArea, flowRate } from "@/lib/fluidFormulas";
import { RHO_WATER } from "@/lib/constants";

const safe = (v: number, min = 1e-9): number =>
  Number.isFinite(v) ? Math.max(v, min) : min;

export interface NozzleReaction {
  /** Inlet area A₁ = π(D₁/2)²  (m²). */
  a1: number;
  /** Outlet area A₂ = π(D₂/2)²  (m²). */
  a2: number;
  /** Inlet velocity V₁  (m/s). */
  v1: number;
  /** Outlet velocity V₂ = V₁·A₁/A₂  (m/s). */
  v2: number;
  /** Volumetric flow rate Q = A₁·V₁  (m³/s). */
  q: number;
  /** Momentum-change term ρ·Q·(V₂ − V₁)  (N). */
  momentumTerm: number;
  /** Pressure-thrust term P₁·A₁  (N). */
  pressureTerm: number;
  /** Reaction force magnitude R = ρ·Q·(V₂ − V₁) + P₁·A₁  (N). */
  reaction: number;
}

/**
 * Solve the converging-nozzle reaction force.
 * `d2` is clamped to be strictly smaller than `d1` (a real converging nozzle),
 * and all inputs are clamped to physical ranges so the result is always finite.
 */
export function nozzleReaction(
  d1: number,
  d2: number,
  p1: number,
  v1: number,
  rho: number = RHO_WATER,
): NozzleReaction {
  const dia1 = safe(d1);
  // Outlet must converge: keep D₂ strictly below D₁.
  const dia2 = Math.min(safe(d2), dia1 * 0.999);
  const a1 = Math.max(circleArea(dia1), 1e-9);
  const a2 = Math.max(circleArea(dia2), 1e-9);
  const vel1 = Math.max(v1, 0);
  const p = Math.max(p1, 0);

  const v2 = (vel1 * a1) / a2; // continuity: V₂ = V₁·A₁/A₂
  const q = flowRate(a1, vel1); // Q = A₁·V₁
  const momentumTerm = rho * q * (v2 - vel1);
  const pressureTerm = p * a1; // P₂ = 0 gauge (free jet)
  const reaction = momentumTerm + pressureTerm;

  return { a1, a2, v1: vel1, v2, q, momentumTerm, pressureTerm, reaction };
}

/** A particle of fluid travelling through the nozzle / shooting out as a jet. */
export interface NozzleParticle {
  /** Normalised horizontal position 0→1 across the nozzle + jet region. */
  xf: number;
  /** Streamline fraction in [-0.9, 0.9] (share of the local half-height). */
  f: number;
}

/** Seed a fresh set of particles spread across the nozzle + jet region. */
export function seedParticles(count: number): NozzleParticle[] {
  const out: NozzleParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.9 });
  }
  return out;
}

/** Where the converging section starts / ends (fractions of width). */
export const NOZZLE_START = 0.12;
export const NOZZLE_END = 0.62;

/**
 * Local half-height fraction (0→1, share of the max inlet half-height) of the
 * nozzle wall at normalised position xf. Wide inlet → tapers to a narrow outlet
 * → then the free jet stays at the outlet width. `ratio` = D₂/D₁ in [0,1].
 */
export function profileFrac(xf: number, ratio: number): number {
  const r = Math.min(Math.max(ratio, 0.02), 1);
  if (xf <= NOZZLE_START) return 1;
  if (xf >= NOZZLE_END) return r;
  const t = (xf - NOZZLE_START) / (NOZZLE_END - NOZZLE_START);
  // Smooth converging taper from 1 → r.
  const s = t * t * (3 - 2 * t);
  return 1 + (r - 1) * s;
}

/**
 * Local flow speed (m/s) at normalised position xf. Inside the converging
 * section the speed follows continuity V(x) = Q / A(x); once past the outlet the
 * jet keeps the outlet velocity V₂.
 */
export function speedAt(xf: number, q: number, a1: number, ratio: number): number {
  const frac = profileFrac(xf, ratio); // local half-height fraction
  const localArea = Math.max(a1 * frac * frac, 1e-9); // A ∝ (half-height)²
  return q / localArea;
}
