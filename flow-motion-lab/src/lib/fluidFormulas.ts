/**
 * Fluid-mechanics formulas. Pure functions, SI units, no side effects.
 * Each function guards against non-physical input (≤ 0 where it matters) so a
 * mid-drag slider value can never produce NaN/Infinity in the UI.
 */
import { GRAVITY, REYNOLDS_LAMINAR_MAX, REYNOLDS_TURBULENT_MIN } from "./constants";

const safe = (v: number, min = 1e-9): number => (Number.isFinite(v) ? Math.max(v, min) : min);

/** Density ρ = m / V  (kg/m³). */
export const density = (mass: number, volume: number): number => mass / safe(volume);

/** Pressure P = F / A  (Pa). */
export const pressureFromForce = (force: number, area: number): number => force / safe(area);

/** Hydrostatic (gauge) pressure P = ρ g h  (Pa). */
export const hydrostaticPressure = (rho: number, h: number, g: number = GRAVITY): number =>
  rho * g * Math.max(h, 0);

/** Buoyant force F_b = ρ_fluid · g · V_displaced  (N). */
export const buoyantForce = (
  rhoFluid: number,
  volumeDisplaced: number,
  g: number = GRAVITY,
): number => rhoFluid * g * Math.max(volumeDisplaced, 0);

/** Weight W = m g  (N). */
export const weight = (mass: number, g: number = GRAVITY): number => mass * g;

/** Volumetric flow rate Q = A · V  (m³/s). */
export const flowRate = (area: number, velocity: number): number => area * velocity;

/** Continuity: V₂ = A₁ V₁ / A₂  (m/s). */
export const continuityVelocity = (a1: number, v1: number, a2: number): number =>
  (a1 * v1) / safe(a2);

/** Area of a circle from diameter (m²). */
export const circleArea = (diameter: number): number => Math.PI * (diameter / 2) ** 2;

/**
 * Bernoulli pressure at point 2 given point 1, along a streamline:
 * P₂ = P₁ + ½ρ(V₁² − V₂²) + ρg(z₁ − z₂)  (Pa).
 * Assumes steady, incompressible, inviscid flow.
 */
export const bernoulliPressure = (
  p1: number,
  rho: number,
  v1: number,
  v2: number,
  z1: number,
  z2: number,
  g: number = GRAVITY,
): number => p1 + 0.5 * rho * (v1 * v1 - v2 * v2) + rho * g * (z1 - z2);

/** Pressure head = P / (ρ g)  (m). */
export const pressureHead = (p: number, rho: number, g: number = GRAVITY): number =>
  p / (safe(rho) * g);

/** Velocity head = V² / (2g)  (m). */
export const velocityHead = (v: number, g: number = GRAVITY): number => (v * v) / (2 * g);

/** Reynolds number Re = ρ V D / μ  (dimensionless). */
export const reynoldsNumber = (rho: number, v: number, d: number, mu: number): number =>
  (rho * v * d) / safe(mu);

export type FlowRegime = "laminar" | "transitional" | "turbulent";

export const flowRegime = (re: number): FlowRegime => {
  if (re < REYNOLDS_LAMINAR_MAX) return "laminar";
  if (re <= REYNOLDS_TURBULENT_MIN) return "transitional";
  return "turbulent";
};

/** Major (friction) head loss  h_f = f (L/D)(V²/2g)  (m). */
export const majorHeadLoss = (
  f: number,
  length: number,
  diameter: number,
  v: number,
  g: number = GRAVITY,
): number => f * (length / safe(diameter)) * velocityHead(v, g);

/** Minor (fitting) head loss  h_m = K (V²/2g)  (m). */
export const minorHeadLoss = (k: number, v: number, g: number = GRAVITY): number =>
  k * velocityHead(v, g);

/** Tangential speed of a solid-body (rotational) vortex: v = ω r  (m/s). */
export const vortexTangentialSpeed = (omega: number, r: number): number => omega * r;
