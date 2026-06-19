/**
 * Physics + geometry for the Surface Tension & Capillary simulation.
 * A reservoir of water with a thin vertical capillary tube dipped in. Surface
 * tension pulls the liquid up the tube to a height given by Jurin's law:
 *   h = 2σ·cosθ / (ρ·g·r)
 * For a wetting liquid (θ < 90°) cosθ > 0 → rise; for θ > 90° cosθ < 0 →
 * depression (the column sits below the reservoir surface).
 */
import { GRAVITY } from "@/lib/constants";

/**
 * Capillary rise height (m) from Jurin's law.
 * @param sigma          surface tension σ (N/m)
 * @param contactAngleDeg contact angle θ (degrees) — cosθ < 0 for θ > 90°
 * @param rho            liquid density ρ (kg/m³)
 * @param r              tube radius r (m) — guarded > 0
 * @param g              gravitational acceleration (m/s²)
 * @returns rise height h (m); positive = rise, negative = depression.
 */
export function capillaryRise(
  sigma: number,
  contactAngleDeg: number,
  rho: number,
  r: number,
  g: number = GRAVITY,
): number {
  const radius = Math.max(r, 1e-9);
  const density = Math.max(rho, 1e-9);
  const theta = (contactAngleDeg * Math.PI) / 180;
  return (2 * sigma * Math.cos(theta)) / (density * g * radius);
}

/** Convert millimetres to metres. */
export const mmToM = (mm: number): number => mm / 1000;

/** A drifting bit of water dust for ambience. Positions are normalised. */
export interface DustParticle {
  /** Horizontal position 0→1 across the reservoir. */
  xf: number;
  /** Vertical position 0→1 across the stage. */
  yf: number;
  /** Radius in pixels. */
  r: number;
  /** Gentle horizontal drift speed (normalised units per second). */
  vx: number;
}

/** Seed a fresh set of dust particles spread through the reservoir water. */
export function seedDust(count: number, surfaceYf: number, bottomYf: number): DustParticle[] {
  const out: DustParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      yf: surfaceYf + Math.random() * (bottomYf - surfaceYf),
      r: 0.8 + Math.random() * 1.6,
      vx: (Math.random() * 2 - 1) * 0.03,
    });
  }
  return out;
}
