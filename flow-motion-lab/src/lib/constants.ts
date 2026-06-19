/**
 * Physical constants and reference values used across the lab.
 * SI units throughout.
 */

/** Standard gravitational acceleration (m/s²). */
export const GRAVITY = 9.81;

/** Density of fresh water at ~20°C (kg/m³). */
export const RHO_WATER = 1000;

/** Density of air at sea level, ~15°C (kg/m³). */
export const RHO_AIR = 1.225;

/** Atmospheric pressure (Pa). */
export const P_ATM = 101325;

/** Dynamic viscosity of water at ~20°C (Pa·s). */
export const MU_WATER = 0.001;

/** A short catalogue of fluids used in slider presets. */
export interface FluidPreset {
  id: string;
  /** Thai + English label, e.g. "น้ำ Water". */
  label: string;
  /** Density (kg/m³). */
  rho: number;
  /** Dynamic viscosity (Pa·s). */
  mu: number;
}

export const FLUID_PRESETS: FluidPreset[] = [
  { id: "water", label: "น้ำ Water", rho: 1000, mu: 0.001 },
  { id: "seawater", label: "น้ำทะเล Seawater", rho: 1025, mu: 0.00107 },
  { id: "oil", label: "น้ำมันพืช Oil", rho: 920, mu: 0.06 },
  { id: "honey", label: "น้ำผึ้ง Honey", rho: 1420, mu: 10 },
  { id: "air", label: "อากาศ Air", rho: 1.225, mu: 0.0000181 },
];

/** Reynolds number flow-regime thresholds (pipe flow convention). */
export const REYNOLDS_LAMINAR_MAX = 2300;
export const REYNOLDS_TURBULENT_MIN = 4000;
