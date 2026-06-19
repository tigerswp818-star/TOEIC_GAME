/**
 * Physics for the Mach Number simulation (Compressible Flow chapter).
 *
 * An object moves through air at speed V while sound propagates outward at the
 * local speed of sound a. The ratio M = V / a (the **Mach number**) decides the
 * shape of the emitted sound field:
 *   • M < 1  → subsonic   : wavefronts always spread out ahead of the object.
 *   • M = 1  → sonic      : every wavefront piles up tangent at the nose.
 *   • M > 1  → supersonic : the wavefronts envelope into a **Mach cone** whose
 *                           half-angle is μ = asin(1 / M).
 *
 * Pure functions only — no side effects, no rendering. The component owns all
 * animation state (object position + the ring buffer of emitted wavefronts).
 */

/** Flow regime decided by the Mach number. */
export type MachRegime = "subsonic" | "sonic" | "supersonic";

/** A small tolerance band around M = 1 that counts as "sonic". */
export const SONIC_TOLERANCE = 0.02;

/** Mach number M = V / a (object speed over speed of sound). */
export function machNumber(v: number, a: number): number {
  return v / Math.max(a, 1e-6);
}

/**
 * Mach-cone half-angle in **degrees**, defined only for supersonic flow (M > 1).
 * For M ≤ 1 there is no cone, so this returns `null` (the asin domain is also
 * guarded — 1/M would be > 1 and produce NaN otherwise).
 */
export function machAngleDeg(m: number): number | null {
  if (m <= 1) return null;
  return (Math.asin(1 / m) * 180) / Math.PI;
}

/** Classify the flow regime from a Mach number, using SONIC_TOLERANCE near 1. */
export function classifyRegime(m: number): MachRegime {
  if (Math.abs(m - 1) <= SONIC_TOLERANCE) return "sonic";
  return m < 1 ? "subsonic" : "supersonic";
}

/** Thai display label for a regime. */
export function regimeLabelTh(regime: MachRegime): string {
  switch (regime) {
    case "subsonic":
      return "ต่ำกว่าเสียง (Subsonic)";
    case "sonic":
      return "เท่าเสียง (Sonic)";
    case "supersonic":
      return "เหนือเสียง (Supersonic)";
  }
}
