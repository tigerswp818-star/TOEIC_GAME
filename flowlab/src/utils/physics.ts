/**
 * Pure fluid-mechanics calculations.
 *
 * Every function is side-effect free and works in SI base units so it can be
 * unit-tested and reused anywhere. Each carries the governing equation and its
 * key assumptions in the doc comment, because in fluid mechanics the assumptions
 * are as important as the formula (Bernoulli, especially, is easy to misuse).
 */

import {
  GRAVITY,
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
} from "../constants/physics";
import type { BuoyancyState, FlowRegime } from "../types";

/* ------------------------------------------------------------------ */
/* Fluid properties                                                    */
/* ------------------------------------------------------------------ */

/** Density ρ = m / V  →  [kg/m³].  V must be > 0. */
export function calculateDensity(mass: number, volume: number): number {
  if (volume <= 0) return NaN;
  return mass / volume;
}

/** Specific weight γ = ρ·g  →  [N/m³]. */
export function calculateSpecificWeight(density: number, g: number = GRAVITY): number {
  return density * g;
}

/* ------------------------------------------------------------------ */
/* Hydrostatics                                                        */
/* ------------------------------------------------------------------ */

/**
 * Gauge hydrostatic pressure  P = ρ·g·h  →  [Pa].
 * Assumes an incompressible fluid at rest with uniform density and that h is
 * measured downward from the free surface. Returns gauge pressure (relative to
 * the atmosphere); add atmospheric pressure for the absolute value.
 */
export function calculateHydrostaticPressure(
  density: number,
  depth: number,
  g: number = GRAVITY,
): number {
  return density * g * depth;
}

/** Pressure from a force on an area  P = F / A  →  [Pa].  A must be > 0. */
export function calculatePressureFromForce(force: number, area: number): number {
  if (area <= 0) return NaN;
  return force / area;
}

/* ------------------------------------------------------------------ */
/* Buoyancy                                                            */
/* ------------------------------------------------------------------ */

/**
 * Archimedes' buoyant force  F_b = ρ_fluid·g·V_displaced  →  [N].
 * V_displaced is the volume of fluid pushed aside (= submerged volume).
 */
export function calculateBuoyantForce(
  fluidDensity: number,
  displacedVolume: number,
  g: number = GRAVITY,
): number {
  return fluidDensity * g * displacedVolume;
}

/** Weight  W = m·g = ρ·V·g  →  [N]. */
export function calculateWeight(
  objectDensity: number,
  volume: number,
  g: number = GRAVITY,
): number {
  return objectDensity * volume * g;
}

/**
 * Full buoyancy analysis for a fully-immersed object that is then released.
 *
 * Compares the object's average density with the fluid's:
 *  - ρ_obj < ρ_fluid → floats; it rises until only a fraction is submerged.
 *  - ρ_obj > ρ_fluid → sinks; the whole volume stays submerged.
 *  - ρ_obj ≈ ρ_fluid → neutrally buoyant; suspended anywhere in the fluid.
 *
 * `submergedFraction` is the equilibrium fraction of the object's volume below
 * the surface (1 for sinking/neutral objects).
 */
export interface BuoyancyAnalysis {
  buoyantForceSubmerged: number; // F_b if fully submerged [N]
  weight: number; // W [N]
  netForceSubmerged: number; // F_b - W when fully submerged [N]
  state: BuoyancyState;
  submergedFraction: number; // 0..1 at equilibrium
  /** Buoyant force at equilibrium [N] — equals weight when floating/neutral. */
  buoyantForceEquilibrium: number;
}

export function analyzeBuoyancy(
  objectDensity: number,
  objectVolume: number,
  fluidDensity: number,
  g: number = GRAVITY,
): BuoyancyAnalysis {
  const weight = calculateWeight(objectDensity, objectVolume, g);
  const buoyantForceSubmerged = calculateBuoyantForce(fluidDensity, objectVolume, g);
  const netForceSubmerged = buoyantForceSubmerged - weight;

  // Use a small relative tolerance so "equal densities" reads as neutral.
  const ratio = fluidDensity > 0 ? objectDensity / fluidDensity : Infinity;
  let state: BuoyancyState;
  let submergedFraction: number;

  if (Math.abs(ratio - 1) < 1e-3) {
    state = "neutral";
    submergedFraction = 1; // hovers fully immersed
  } else if (ratio < 1) {
    state = "float";
    submergedFraction = ratio; // V_sub / V = ρ_obj / ρ_fluid
  } else {
    state = "sink";
    submergedFraction = 1;
  }

  // At equilibrium a floating object displaces exactly its own weight of fluid.
  const buoyantForceEquilibrium =
    state === "float" ? weight : buoyantForceSubmerged;

  return {
    buoyantForceSubmerged,
    weight,
    netForceSubmerged,
    state,
    submergedFraction,
    buoyantForceEquilibrium,
  };
}

/* ------------------------------------------------------------------ */
/* Continuity                                                          */
/* ------------------------------------------------------------------ */

/** Volumetric flow rate  Q = A·V  →  [m³/s]. */
export function calculateFlowRate(area: number, velocity: number): number {
  return area * velocity;
}

/**
 * Continuity for incompressible steady flow  A₁V₁ = A₂V₂  →  V₂ [m/s].
 * A₂ must be > 0.
 */
export function calculateContinuityVelocity(
  area1: number,
  velocity1: number,
  area2: number,
): number {
  if (area2 <= 0) return NaN;
  return (area1 * velocity1) / area2;
}

/** Cross-sectional area of a circular pipe  A = π·(D/2)²  →  [m²]. */
export function circleArea(diameter: number): number {
  const r = diameter / 2;
  return Math.PI * r * r;
}

/** Diameter of a circle from its area  D = 2·√(A/π)  →  [m]. */
export function diameterFromArea(area: number): number {
  if (area <= 0) return NaN;
  return 2 * Math.sqrt(area / Math.PI);
}

/* ------------------------------------------------------------------ */
/* Bernoulli                                                           */
/* ------------------------------------------------------------------ */

/**
 * The three "heads" of Bernoulli's equation (energy per unit weight), all [m]:
 *   pressure head   P/(ρg)
 *   velocity head   V²/(2g)
 *   elevation head  z
 * Their sum is the total head H. Valid only for steady, incompressible,
 * inviscid flow along a streamline (no friction, no pump/turbine work).
 */
export interface BernoulliHeads {
  pressureHead: number;
  velocityHead: number;
  elevationHead: number;
  totalHead: number;
}

export function calculateBernoulliHeads(
  pressure: number,
  velocity: number,
  elevation: number,
  density: number,
  g: number = GRAVITY,
): BernoulliHeads {
  const pressureHead = density > 0 ? pressure / (density * g) : NaN;
  const velocityHead = (velocity * velocity) / (2 * g);
  const elevationHead = elevation;
  return {
    pressureHead,
    velocityHead,
    elevationHead,
    totalHead: pressureHead + velocityHead + elevationHead,
  };
}

/**
 * Venturi pressure at the throat for horizontal flow (z₁ = z₂).
 * From continuity V₂ = V₁·A₁/A₂ and Bernoulli
 *   P₂ = P₁ + ½ρ(V₁² − V₂²).
 * Returns both the throat velocity and the throat pressure.
 */
export interface VenturiResult {
  throatVelocity: number; // V₂ [m/s]
  throatPressure: number; // P₂ [Pa]
  pressureDrop: number; // P₁ − P₂ [Pa] (positive = pressure falls in throat)
}

export function calculateVenturi(
  inletPressure: number,
  inletVelocity: number,
  inletArea: number,
  throatArea: number,
  density: number,
): VenturiResult {
  const throatVelocity = calculateContinuityVelocity(
    inletArea,
    inletVelocity,
    throatArea,
  );
  const throatPressure =
    inletPressure +
    0.5 * density * (inletVelocity * inletVelocity - throatVelocity * throatVelocity);
  return {
    throatVelocity,
    throatPressure,
    pressureDrop: inletPressure - throatPressure,
  };
}

/* ------------------------------------------------------------------ */
/* Reynolds number                                                     */
/* ------------------------------------------------------------------ */

/**
 * Reynolds number  Re = ρ·V·D / μ  (dimensionless).
 * The ratio of inertial to viscous forces. μ must be > 0.
 */
export function calculateReynoldsNumber(
  density: number,
  velocity: number,
  diameter: number,
  viscosity: number,
): number {
  if (viscosity <= 0) return NaN;
  return (density * velocity * diameter) / viscosity;
}

/** Classify pipe-flow regime from Re using the standard thresholds. */
export function classifyFlowRegime(reynolds: number): FlowRegime {
  if (reynolds < RE_LAMINAR_MAX) return "laminar";
  if (reynolds <= RE_TURBULENT_MIN) return "transitional";
  return "turbulent";
}

/* ------------------------------------------------------------------ */
/* Pipe head loss (Darcy–Weisbach)                                     */
/* ------------------------------------------------------------------ */

/**
 * Major (friction) head loss  h_f = f·(L/D)·V²/(2g)  →  [m].
 * D must be > 0. Scales with V², so doubling velocity quadruples the loss.
 */
export function calculateMajorLoss(
  frictionFactor: number,
  length: number,
  diameter: number,
  velocity: number,
  g: number = GRAVITY,
): number {
  if (diameter <= 0) return NaN;
  return frictionFactor * (length / diameter) * ((velocity * velocity) / (2 * g));
}

/**
 * Minor (fitting) head loss  h_m = K·V²/(2g)  →  [m].
 * K is the (summed) loss coefficient of valves, bends and fittings.
 */
export function calculateMinorLoss(
  lossCoefficient: number,
  velocity: number,
  g: number = GRAVITY,
): number {
  return lossCoefficient * ((velocity * velocity) / (2 * g));
}

export interface HeadLossResult {
  majorLoss: number;
  minorLoss: number;
  totalLoss: number;
}

export function calculateHeadLoss(
  frictionFactor: number,
  length: number,
  diameter: number,
  velocity: number,
  lossCoefficient: number,
  g: number = GRAVITY,
): HeadLossResult {
  const majorLoss = calculateMajorLoss(frictionFactor, length, diameter, velocity, g);
  const minorLoss = calculateMinorLoss(lossCoefficient, velocity, g);
  return {
    majorLoss,
    minorLoss,
    totalLoss: majorLoss + minorLoss,
  };
}

/**
 * Convert a head [m] to a pressure drop [Pa] via Δp = ρ·g·h — useful for showing
 * head loss in pressure terms too.
 */
export function headToPressure(
  head: number,
  density: number,
  g: number = GRAVITY,
): number {
  return density * g * head;
}
