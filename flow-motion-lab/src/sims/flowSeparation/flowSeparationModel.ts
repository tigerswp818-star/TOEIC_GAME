/**
 * Model for the "Flow Separation & Vortex Shedding" simulation (Chapter:
 * Boundary Layer & External Flow).
 *
 * Fluid streams left→right past a circular cylinder. Near the front the boundary
 * layer hugs the surface, but downstream the pressure rises again (an *adverse
 * pressure gradient*) and the slow-moving fluid in the boundary layer can no
 * longer push forward — it **separates** from the surface. Behind the body a
 * low-pressure **wake** forms (the source of pressure / form drag), and above a
 * critical Reynolds number the wake sheds alternating rotating vortices: a
 * **Kármán vortex street**.
 *
 * This file owns ALL the new physics for the simulation. Everything here is
 * deliberately *qualitative / illustrative* (it captures the right trends, not
 * laboratory-accurate numbers). It re-uses the classic potential-flow cylinder
 * field from the Flow-Around sim for the visible streamlines & advection — pure
 * functions only, no side effects.
 *
 * Re-exports `velocityAt` / `insideBody` / `pressureCoefficient` from the
 * Flow-Around model so the sim component has one import surface.
 */
import { clamp, lerp, smoothstep } from "@/lib/math";
import { velocityAt, insideBody, pressureCoefficient } from "../flowAround/flowAroundModel";

export { velocityAt, insideBody, pressureCoefficient };

/** Inputs that drive the Reynolds number for this external-flow scenario. */
export interface SeparationInputs {
  /** Reynolds number, supplied directly (this sim controls Re via a log slider). */
  re: number;
  /** Surface roughness 0→1; nudges the laminar→turbulent transition earlier. */
  roughness: number;
}

/** Below this Re a steady attached/creeping wake exists with no shedding. */
export const SHEDDING_ONSET_RE = 40;
/** Rough Re where a smooth cylinder's boundary layer goes turbulent ("drag crisis"). */
export const TRANSITION_RE = 2e5;

/**
 * Clamp/normalise a raw Reynolds number to the simulation's working band.
 * Guards against non-finite or non-positive input (divide-by-zero safety for
 * any downstream ratio that uses Re).
 */
export function reynoldsNumber(re: number): number {
  if (!Number.isFinite(re) || re <= 0) return 1;
  return clamp(re, 1, 1e6);
}

/**
 * Effective transition Reynolds number. A rough surface trips the boundary layer
 * to turbulent much earlier, so the transition Re drops as roughness rises.
 */
export function transitionRe(roughness: number): number {
  const r = clamp(roughness, 0, 1);
  // From ~2e5 (smooth) down toward ~1e4 (very rough) — illustrative.
  const exp = lerp(Math.log10(TRANSITION_RE), 4.0, r);
  return 10 ** exp;
}

/**
 * Separation angle measured in degrees from the FRONT stagnation point (0° = nose,
 * 180° = rear). Illustrative behaviour:
 *  - Very low Re (creeping): flow stays attached almost to the rear → large angle.
 *  - Laminar separation (Re up to transition): boundary layer separates early,
 *    settling near ~80° from the front.
 *  - After the boundary layer turns turbulent it carries more momentum and
 *    *reattaches later*, pushing separation back toward ~120°.
 * Roughness brings the turbulent reattachment forward in Re (drag-crisis trip).
 */
export function separationAngle(re: number, roughness = 0): number {
  const R = reynoldsNumber(re);
  // Creeping flow (Re ≲ 5): essentially attached, separation deep at the back.
  const creep = smoothstep(0.7, 1.0, Math.log10(R)); // 0 at Re~5, 1 by Re~10
  const attachedAngle = lerp(170, 90, creep); // 170° → 90° as Re climbs past creeping

  // Laminar regime settles toward ~80° from the front.
  const laminarAngle = lerp(attachedAngle, 80, smoothstep(1.5, 3.5, Math.log10(R)));

  // Turbulent boundary layer (past the effective transition Re) reattaches later.
  const trip = transitionRe(roughness);
  const turbT = smoothstep(Math.log10(trip) - 0.5, Math.log10(trip) + 0.5, Math.log10(R));
  const angle = lerp(laminarAngle, 120, turbT);

  return clamp(angle, 60, 175);
}

/**
 * Relative wake width (≈ 0…1.3, dimensionless). Grows as the separation point
 * moves forward (earlier separation → fatter wake) and shrinks sharply when the
 * boundary layer turns turbulent and reattaches (the classic drag-crisis wake
 * narrowing). Tied directly to the separation angle so the picture stays
 * self-consistent.
 */
export function wakeWidth(re: number, roughness = 0): number {
  const ang = separationAngle(re, roughness);
  // Earlier separation (small angle) → wider wake. Map 80°→wide, 170°→narrow.
  const fromAngle = clamp((150 - ang) / 90, 0, 1.2);
  // Below the shedding onset the wake is a small steady recirculation bubble.
  const onset = smoothstep(5, SHEDDING_ONSET_RE, reynoldsNumber(re));
  return clamp(0.15 + fromAngle * onset, 0.1, 1.3);
}

/**
 * Vortex-shedding strength in [0, 1].
 *  - 0 below ~Re 40 (steady wake, no shedding).
 *  - rises through the laminar vortex-street band.
 *  - dips a little once the wake narrows in the turbulent regime, but stays on.
 */
export function sheddingStrength(re: number, roughness = 0): number {
  const R = reynoldsNumber(re);
  if (R < SHEDDING_ONSET_RE) return 0;
  const ramp = smoothstep(SHEDDING_ONSET_RE, 400, R); // 0→1 across the onset band
  // Slight reduction once the wake narrows (turbulent reattachment).
  const trip = transitionRe(roughness);
  const narrow = smoothstep(Math.log10(trip) - 0.3, Math.log10(trip) + 0.6, Math.log10(R));
  return clamp(ramp * (1 - 0.35 * narrow), 0, 1);
}

/**
 * Illustrative Strouhal number St = f·D / U for the vortex street. Roughly 0.2
 * across a broad Re range once shedding starts; eases up a touch at higher Re.
 * Returns 0 when there is no shedding.
 */
export function strouhalNumber(re: number, roughness = 0): number {
  if (sheddingStrength(re, roughness) <= 0) return 0;
  const t = smoothstep(SHEDDING_ONSET_RE, 1e4, reynoldsNumber(re));
  return lerp(0.12, 0.21, t);
}

/** A tracer particle advected through / around the wake, in pixel space. */
export interface Tracer {
  x: number;
  y: number;
  /** Per-particle random phase so wake jitter looks uncorrelated. */
  seed: number;
}

/** Seed a fresh set of tracers spread across the canvas. */
export function seedTracers(count: number, width: number, height: number): Tracer[] {
  const out: Tracer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * width,
      y: Math.random() * height,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/** A single shed vortex drifting downstream in the Kármán street. */
export interface ShedVortex {
  /** Normalised downstream position 0→1 (left→right) along the wake. */
  xf: number;
  /** Sign of rotation: +1 (upper row, clockwise on screen) / −1 (lower row). */
  sign: 1 | -1;
  /** Current spin angle (rad), advanced by dt. */
  spin: number;
}
