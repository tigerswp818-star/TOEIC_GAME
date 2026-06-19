/**
 * Pure physics + geometry helpers for the Buoyancy simulation.
 *
 * A rectangular object sits in a water tank (side view). How deep it floats is
 * governed by Archimedes' principle: the submerged fraction of the box decides
 * how much fluid it displaces, which sets the buoyant force that fights gravity.
 * All functions are side-effect free and operate in SI units so the React layer
 * can integrate them frame-by-frame with the canvas `dt`.
 */
import { clamp } from "@/lib/math";
import { buoyantForce, weight } from "@/lib/fluidFormulas";

/** Mutable kinematic state of the box, persisted across frames in a ref. */
export interface BoxState {
  /** Vertical position of the box centre, normalised 0 (tank top) → 1 (bottom). */
  y: number;
  /** Vertical velocity in normalised units per second (down positive). */
  vy: number;
}

/** A floating/sinking outcome used for status strings and colour tones. */
export type FloatStatus = "float" | "sink" | "neutral";

/** Mass of the object  m = ρ_object · V  (kg). */
export const objectMass = (rhoObject: number, volume: number): number =>
  rhoObject * Math.max(volume, 0);

/**
 * Fraction of the box (0→1) that is below the water surface, from geometry.
 * `topY`/`bottomY` and `surfaceY` are all normalised vertical coordinates
 * (0 = tank top, 1 = tank bottom). Above the surface → 0, fully under → 1.
 */
export function submergedFraction(
  topY: number,
  bottomY: number,
  surfaceY: number,
): number {
  const heightN = bottomY - topY;
  if (heightN <= 1e-9) return surfaceY >= bottomY ? 1 : 0;
  const submergedDepth = bottomY - Math.max(topY, surfaceY);
  return clamp(submergedDepth / heightN, 0, 1);
}

/**
 * The equilibrium submerged fraction predicted by theory for a *floating* body:
 * ρ_object / ρ_fluid (capped at 1). For a sinking body this would exceed 1, so
 * it is clamped — meaning the box ends fully submerged and rests on the bottom.
 */
export const equilibriumSubmergedFraction = (
  rhoObject: number,
  rhoFluid: number,
): number => clamp(rhoObject / Math.max(rhoFluid, 1e-9), 0, 1);

/** Classify the outcome by comparing densities (with a small neutral band). */
export function classify(rhoObject: number, rhoFluid: number): FloatStatus {
  const ratio = rhoObject / Math.max(rhoFluid, 1e-9);
  if (ratio > 1.02) return "sink";
  if (ratio < 0.98) return "float";
  return "neutral";
}

/** Bilingual status label for the UI headline. */
export const statusLabel = (s: FloatStatus): string =>
  s === "float" ? "ลอย Float" : s === "sink" ? "จม Sink" : "ลอยกลางน้ำ Neutral";

/** Force breakdown for a given submerged fraction (all in newtons). */
export interface ForceReadout {
  fb: number;
  w: number;
  net: number;
  mass: number;
}

/**
 * Resolve the live forces on the box. `volume` is the object volume (m³),
 * `frac` the currently submerged fraction (0→1). Net is up-positive (Fb − W).
 */
export function forces(
  rhoObject: number,
  rhoFluid: number,
  volume: number,
  frac: number,
): ForceReadout {
  const mass = objectMass(rhoObject, volume);
  const fb = buoyantForce(rhoFluid, volume * clamp(frac, 0, 1));
  const w = weight(mass);
  return { fb, w, net: fb - w, mass };
}

/**
 * Advance the box one frame with simple damped vertical dynamics.
 *
 * a = netForce / mass, then v is integrated and bled off by water drag so the
 * box settles instead of oscillating forever. The box centre is kept inside the
 * tank between `minY` and `maxY` (normalised), bouncing softly off the bottom.
 *
 * Returns a fresh BoxState — callers mutate their ref with the result.
 */
export function stepBox(
  state: BoxState,
  params: {
    rhoObject: number;
    rhoFluid: number;
    volume: number;
    /** Normalised half-height of the box (so top = y − half, bottom = y + half). */
    halfN: number;
    /** Normalised water-surface position (0 = tank top, 1 = bottom). */
    surfaceY: number;
    minY: number;
    maxY: number;
  },
  dt: number,
): BoxState {
  // Paused frames (dt = 0) leave everything frozen.
  if (dt <= 0) return state;
  const dtc = Math.min(dt, 0.05); // guard against giant tab-switch steps

  const { rhoObject, rhoFluid, volume, halfN, surfaceY, minY, maxY } = params;
  const topY = state.y - halfN;
  const bottomY = state.y + halfN;
  const frac = submergedFraction(topY, bottomY, surfaceY);
  const { net, mass } = forces(rhoObject, rhoFluid, volume, frac);

  // Acceleration: down is +y, so a *positive* net (upward) reduces y.
  // Scale newtons → normalised acceleration with a gentle visual factor.
  const ACCEL_SCALE = 0.012;
  const a = (-net / Math.max(mass, 1e-6)) * ACCEL_SCALE;

  let vy = state.vy + a * dtc;

  // Water drag: heavier while submerged so the box settles calmly. Quadratic
  // term tames fast plunges; linear term guarantees it eventually stops.
  const dragK = frac > 0.01 ? 2.6 : 0.6;
  vy -= vy * Math.abs(vy) * dragK * dtc;
  vy *= 1 - Math.min(0.9, (frac > 0.01 ? 3.0 : 1.2) * dtc);

  let y = state.y + vy * dtc;

  // Keep the box inside the tank; damp the velocity on contact.
  if (y < minY) {
    y = minY;
    vy *= -0.25;
  }
  if (y > maxY) {
    y = maxY;
    vy *= -0.25;
  }

  // Kill micro-jitter once essentially at rest.
  if (Math.abs(vy) < 1e-4) vy = 0;

  return { y, vy };
}
