/**
 * Physics + geometry helpers for the U-tube Manometer simulation.
 * A U-tube connects two pressure taps; the manometer-fluid level difference h
 * relates to the pressure difference by ΔP = ρ_m · g · h. Higher pressure on one
 * side pushes that column DOWN and the other UP, so the level difference encodes
 * the pressure difference directly.
 */
import { mapClamped } from "@/lib/math";

/** Maximum pressure difference the sliders represent (Pa). */
export const DP_MAX = 50000;

/** Level difference h (m) from a pressure difference: h = ΔP / (ρ_m · g). */
export function heightFromDP(dp: number, rho: number, g: number): number {
  return Math.max(dp, 0) / Math.max(rho * g, 1e-9);
}

/** Pressure difference ΔP (Pa) from a level difference: ΔP = ρ_m · g · h. */
export function dpFromHeight(h: number, rho: number, g: number): number {
  return Math.max(h, 0) * rho * g;
}

/** Manometer-fluid presets (kg/m³) the ToggleChip group can apply to ρ_m. */
export interface ManometerFluid {
  id: string;
  label: string;
  icon: string;
  rho: number;
}

export const MANOMETER_FLUIDS: ManometerFluid[] = [
  { id: "mercury", label: "ปรอท Mercury", icon: "🌡️", rho: 13600 },
  { id: "water", label: "น้ำ Water", icon: "💧", rho: 1000 },
  { id: "oil", label: "น้ำมัน Oil", icon: "🛢️", rho: 820 },
];

/**
 * Map a level difference h (m) onto a column displacement in pixels, clamped so
 * the fluid never overflows the tube. `tubeSpan` is the usable column height in
 * pixels; `hVisualMax` is the h (m) that fills the whole span.
 */
export function heightToPx(h: number, tubeSpan: number, hVisualMax: number): number {
  return mapClamped(h, 0, hVisualMax, 0, tubeSpan);
}

/** A drifting bubble in one of the columns. Positions are normalised 0→1. */
export interface Bubble {
  /** Which column: -1 = high-pressure (left), +1 = low-pressure (right). */
  side: -1 | 1;
  /** Vertical position 0 (top of fluid) → 1 (bottom) within the column. */
  yf: number;
  /** Horizontal jitter -1→1 across the column width. */
  xf: number;
  /** Radius in pixels. */
  r: number;
  /** Upward drift speed (normalised units per second). */
  vy: number;
}

/** Seed a fresh set of bubbles split between the two columns. */
export function seedBubbles(count: number): Bubble[] {
  const out: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      side: i % 2 === 0 ? -1 : 1,
      yf: Math.random(),
      xf: (Math.random() * 2 - 1) * 0.6,
      r: 0.8 + Math.random() * 1.4,
      vy: 0.05 + Math.random() * 0.12,
    });
  }
  return out;
}
