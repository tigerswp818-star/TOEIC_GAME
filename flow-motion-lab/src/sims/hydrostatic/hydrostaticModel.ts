/**
 * Geometry + helpers for the Hydrostatic Pressure simulation.
 * A side-view tank of still water. Gauge pressure grows linearly with depth,
 * P(h) = ρ·g·h, which drives the depth shading, wall arrows and the gauge dial.
 */
import { hydrostaticPressure } from "@/lib/fluidFormulas";
import { mapClamped } from "@/lib/math";

/** Maximum probe depth the tank represents (m) — matches the slider range. */
export const DEPTH_MAX = 10;

/** Normalised tank geometry (0 = top of stage, 1 = bottom). */
export const SURFACE_Y = 0.14; // water surface line
export const TANK_TOP = 0.06;
export const TANK_BOTTOM = 0.96;

/**
 * Full-scale pressure for the gauge dial (Pa). Computed from the slider maxima
 * (ρ = 1400, g = 20, h = 10) so the needle never pins past its arc.
 */
export const P_MAX_GAUGE = hydrostaticPressure(1400, DEPTH_MAX, 20);

/** Gauge arc sweep, in radians. Needle travels −135°…+135° (270° of sweep). */
export const GAUGE_ANGLE_MIN = (-135 * Math.PI) / 180;
export const GAUGE_ANGLE_MAX = (135 * Math.PI) / 180;

/** Gauge pressure at an arbitrary depth (m) for the current fluid + gravity. */
export function pressureAtDepth(depth: number, rho: number, g: number): number {
  return hydrostaticPressure(rho, depth, g);
}

/** Map a pressure (Pa) onto the gauge-dial needle angle (radians). */
export function gaugeAngle(pressure: number): number {
  return mapClamped(pressure, 0, P_MAX_GAUGE, GAUGE_ANGLE_MIN, GAUGE_ANGLE_MAX);
}

/** Normalised y of a probe depth within the water column (surface → bottom). */
export function depthToY(depth: number): number {
  return mapClamped(depth, 0, DEPTH_MAX, SURFACE_Y, TANK_BOTTOM);
}

/** A drifting water-dust particle for ambience. Positions are normalised. */
export interface DustParticle {
  /** Horizontal position 0→1 across the tank water. */
  xf: number;
  /** Vertical position 0→1 across the stage. */
  yf: number;
  /** Radius in pixels. */
  r: number;
  /** Gentle horizontal drift speed (normalised units per second). */
  vx: number;
}

/** Seed a fresh set of dust particles spread through the water column. */
export function seedDust(count: number): DustParticle[] {
  const out: DustParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      yf: SURFACE_Y + Math.random() * (TANK_BOTTOM - SURFACE_Y),
      r: 0.8 + Math.random() * 1.6,
      vx: (Math.random() * 2 - 1) * 0.03,
    });
  }
  return out;
}
