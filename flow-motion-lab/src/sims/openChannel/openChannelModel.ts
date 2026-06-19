/**
 * Physics + particle model for the Open Channel Flow simulation.
 * Rectangular channel solved with Manning's equation:
 *   A  = b·y                 (cross-sectional flow area)
 *   P  = b + 2y              (wetted perimeter)
 *   R  = A/P                 (hydraulic radius)
 *   V  = (1/n)·R^(2/3)·S^(1/2)   (mean velocity, Manning)
 *   Q  = V·A                 (volumetric flow rate)
 *   Fr = V / √(g·y)          (Froude number)
 * Every helper guards its inputs to stay > 0 so the renderer never divides by
 * zero or feeds NaN to the canvas.
 */
import { GRAVITY } from "@/lib/constants";

export interface ChannelParticle {
  /** Normalised horizontal position 0→1 along the channel. */
  xf: number;
  /** Depth fraction in [0,1]: 0 = channel bed, 1 = water surface. */
  df: number;
}

export interface ChannelResult {
  /** Flow area A = b·y (m²). */
  area: number;
  /** Wetted perimeter P = b + 2y (m). */
  perimeter: number;
  /** Hydraulic radius R = A/P (m). */
  radius: number;
  /** Mean velocity V from Manning (m/s). */
  velocity: number;
  /** Volumetric flow rate Q = V·A (m³/s). */
  flow: number;
  /** Froude number Fr = V/√(gy). */
  froude: number;
}

export type FroudeRegime = "subcritical" | "critical" | "supercritical";

/** Cross-sectional flow area of a rectangular channel: A = b·y. */
export function channelArea(b: number, y: number): number {
  return Math.max(b, 1e-6) * Math.max(y, 1e-6);
}

/** Wetted perimeter of a rectangular channel: P = b + 2y. */
export function wettedPerimeter(b: number, y: number): number {
  return Math.max(b, 1e-6) + 2 * Math.max(y, 1e-6);
}

/** Hydraulic radius R = A/P. */
export function hydraulicRadius(b: number, y: number): number {
  return channelArea(b, y) / Math.max(wettedPerimeter(b, y), 1e-6);
}

/** Manning mean velocity V = (1/n)·R^(2/3)·S^(1/2). */
export function manningVelocity(n: number, b: number, y: number, s: number): number {
  const r = hydraulicRadius(b, y);
  return (1 / Math.max(n, 1e-6)) * Math.pow(Math.max(r, 1e-9), 2 / 3) * Math.sqrt(Math.max(s, 0));
}

/** Volumetric flow rate Q = V·A. */
export function channelFlow(n: number, b: number, y: number, s: number): number {
  return manningVelocity(n, b, y, s) * channelArea(b, y);
}

/** Froude number Fr = V/√(g·y). */
export function froudeNumber(v: number, y: number): number {
  return v / Math.sqrt(GRAVITY * Math.max(y, 1e-6));
}

/** Classify the flow regime from the Froude number. */
export function froudeRegime(fr: number): FroudeRegime {
  if (fr > 1.0 + 0.02) return "supercritical";
  if (fr < 1.0 - 0.02) return "subcritical";
  return "critical";
}

/** Solve every channel quantity in one pass (all guarded > 0). */
export function computeChannel(s: number, n: number, y: number, b: number): ChannelResult {
  const area = channelArea(b, y);
  const perimeter = wettedPerimeter(b, y);
  const radius = area / Math.max(perimeter, 1e-6);
  const velocity = manningVelocity(n, b, y, s);
  const flow = velocity * area;
  const froude = froudeNumber(velocity, y);
  return { area, perimeter, radius, velocity, flow, froude };
}

/** Seed particles spread across the channel length and depth. */
export function seedParticles(count: number): ChannelParticle[] {
  const out: ChannelParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), df: Math.random() });
  }
  return out;
}
