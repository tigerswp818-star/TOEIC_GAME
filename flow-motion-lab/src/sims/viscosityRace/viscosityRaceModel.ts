/**
 * Physics + particle model for the Viscosity Flow Race simulation.
 *
 * Several fluids run down an inclined ramp. For a thin laminar film flowing
 * steadily down a slope, the characteristic (surface / mean) film velocity
 * scales like
 *
 *      v ∝ ρ·g·sinθ / μ
 *
 * i.e. heavier fluids and steeper slopes flow faster, while higher viscosity
 * (μ) slows the flow because viscous shear resists the motion. We report this
 * in *relative* units (a fixed scale factor) so learners can compare lanes
 * rather than read an absolute physical speed.
 */
import { GRAVITY, FLUID_PRESETS, type FluidPreset } from "@/lib/constants";

/** Scale factor turning ρg·sinθ/μ into a convenient relative-speed number. */
const SCALE = 0.001;

/**
 * Steady laminar-film speed on an incline, in relative units.
 * v ∝ ρ·g·sinθ / μ  (θ in degrees).
 */
export function filmSpeed(
  rho: number,
  mu: number,
  slopeDeg: number,
  g: number = GRAVITY,
): number {
  const sinTheta = Math.sin((slopeDeg * Math.PI) / 180);
  return (rho * g * sinTheta * SCALE) / Math.max(mu, 1e-6);
}

/** A racing lane: a named preset fluid with its density & viscosity. */
export interface RaceFluid {
  id: string;
  /** Thai + English label, e.g. "น้ำ Water". */
  label: string;
  /** Short Thai label for the lane tag in the canvas. */
  tag: string;
  /** Density (kg/m³). */
  rho: number;
  /** Dynamic viscosity (Pa·s). */
  mu: number;
  /** Lane colour (CSS). */
  color: string;
}

const byId = (id: string): FluidPreset => {
  const f = FLUID_PRESETS.find((p) => p.id === id);
  if (!f) throw new Error(`Unknown fluid preset: ${id}`);
  return f;
};

const water = byId("water");
const oil = byId("oil");
const honey = byId("honey");

/** The three fixed preset lanes always racing down the ramp. */
export const RACE_FLUIDS: RaceFluid[] = [
  { id: "water", label: "น้ำ Water", tag: "น้ำ", rho: water.rho, mu: water.mu, color: "#38bdf8" },
  { id: "oil", label: "น้ำมัน Oil", tag: "น้ำมัน", rho: oil.rho, mu: oil.mu, color: "#facc15" },
  { id: "honey", label: "น้ำผึ้ง Honey", tag: "น้ำผึ้ง", rho: honey.rho, mu: honey.mu, color: "#f59e0b" },
];

/** One particle travelling down a single lane (0 = top of ramp, 1 = bottom). */
export interface RaceParticle {
  /** Normalised position along the ramp, 0→1. */
  s: number;
  /** Lateral jitter within the lane, in [-0.5, 0.5] of the lane width. */
  j: number;
}

/** Seed a row of particles for one lane, spread along the ramp. */
export function seedLaneParticles(count: number): RaceParticle[] {
  const out: RaceParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ s: Math.random(), j: (Math.random() * 2 - 1) * 0.5 });
  }
  return out;
}
