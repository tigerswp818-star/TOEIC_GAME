/**
 * Physical constants and sensible default values used across the simulators.
 * All values are in SI base units unless the name says otherwise.
 *
 * Keeping these in one place means a single source of truth: change g here and
 * every calculation that doesn't override it updates automatically.
 */

/** Standard gravitational acceleration near Earth's surface [m/s²]. */
export const GRAVITY = 9.81;

/** Density of fresh water at ~4 °C [kg/m³]. */
export const RHO_WATER = 1000;

/** Density of sea water (typical) [kg/m³]. */
export const RHO_SEAWATER = 1025;

/** Density of air at 20 °C, 1 atm [kg/m³]. */
export const RHO_AIR = 1.204;

/** Dynamic viscosity of water at ~20 °C [Pa·s]. */
export const MU_WATER = 1.002e-3;

/** Standard atmospheric pressure [Pa]. */
export const P_ATM = 101325;

/** Reynolds-number thresholds for flow in a circular pipe (dimensionless). */
export const RE_LAMINAR_MAX = 2300;
export const RE_TURBULENT_MIN = 4000;

/**
 * A small library of common fluids so learners can pick a realistic preset
 * instead of memorising numbers. Densities [kg/m³], viscosities [Pa·s].
 */
export interface FluidPreset {
  id: string;
  /** Thai name shown to the learner. */
  name: string;
  /** English label kept alongside, per the bilingual content guideline. */
  nameEn: string;
  density: number;
  viscosity: number;
}

export const FLUID_PRESETS: FluidPreset[] = [
  { id: "water", name: "น้ำจืด", nameEn: "Fresh water", density: RHO_WATER, viscosity: MU_WATER },
  { id: "seawater", name: "น้ำทะเล", nameEn: "Sea water", density: RHO_SEAWATER, viscosity: 1.07e-3 },
  { id: "oil", name: "น้ำมันเครื่อง (SAE 30)", nameEn: "Engine oil", density: 891, viscosity: 0.29 },
  { id: "glycerin", name: "กลีเซอรีน", nameEn: "Glycerin", density: 1260, viscosity: 1.41 },
  { id: "mercury", name: "ปรอท", nameEn: "Mercury", density: 13534, viscosity: 1.526e-3 },
  { id: "air", name: "อากาศ", nameEn: "Air", density: RHO_AIR, viscosity: 1.81e-5 },
  { id: "ethanol", name: "เอทานอล", nameEn: "Ethanol", density: 789, viscosity: 1.2e-3 },
];

/**
 * Materials with characteristic densities — handy for the buoyancy lab so a
 * learner can drop in "ไม้ก๊อก (cork)" and immediately see why it floats.
 */
export interface MaterialPreset {
  id: string;
  name: string;
  nameEn: string;
  density: number;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: "cork", name: "ไม้ก๊อก", nameEn: "Cork", density: 240 },
  { id: "ice", name: "น้ำแข็ง", nameEn: "Ice", density: 917 },
  { id: "wood", name: "ไม้สัก", nameEn: "Teak wood", density: 650 },
  { id: "plastic", name: "พลาสติก (HDPE)", nameEn: "HDPE plastic", density: 950 },
  { id: "rubber", name: "ยาง", nameEn: "Rubber", density: 1100 },
  { id: "aluminum", name: "อะลูมิเนียม", nameEn: "Aluminum", density: 2700 },
  { id: "steel", name: "เหล็กกล้า", nameEn: "Steel", density: 7850 },
];
