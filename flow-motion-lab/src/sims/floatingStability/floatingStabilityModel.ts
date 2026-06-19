/**
 * Pure physics + geometry for the Floating Stability & Metacenter simulation.
 *
 * A floating boat cross-section (per unit length into the page) can be heeled
 * (tilted) by an angle. Its stability is judged by the metacentric height GM:
 *
 *   KB = draft / 2                 (centre of buoyancy above the keel, m)
 *   BM = I / V                     (metacentric radius, m)
 *        I = beam³ / 12            (2nd moment of the waterplane, per unit length)
 *        V = beam · draft          (submerged area, per unit length)
 *   GM = KB + BM − KG              (metacentric height, m)
 *   GZ = GM · sin(θ)              (righting arm at heel angle θ)
 *
 * Stable when GM > 0 (the metacentre M sits above the centre of gravity G, so a
 * heel produces a restoring/righting moment). Unstable when GM < 0 (M below G →
 * the moment tips the boat further → capsize).
 *
 * All functions are side-effect free and SI, so the React layer can integrate
 * them frame-by-frame using the canvas `dt`.
 */
import { clamp } from "@/lib/math";

/** Geometry of the floating cross-section. KG/draft/beam in metres; heel in degrees. */
export interface BoatParams {
  /** Height of the centre of gravity G above the keel (m). */
  kg: number;
  /** Beam — width of the hull at the waterline (m). */
  beam: number;
  /** Draft — how deep the hull sits in the water (m). */
  draft: number;
  /** Heel angle the learner sets with the slider (degrees). */
  heel: number;
}

/** Centre of buoyancy above the keel:  KB = draft / 2  (m). */
export const centreOfBuoyancy = (draft: number): number => Math.max(draft, 0) / 2;

/** Second moment of the waterplane per unit length:  I = beam³ / 12  (m³). */
export const waterplaneInertia = (beam: number): number =>
  Math.max(beam, 0) ** 3 / 12;

/** Submerged area per unit length:  V = beam · draft  (m²). */
export const submergedArea = (beam: number, draft: number): number =>
  Math.max(beam, 0) * Math.max(draft, 0);

/** Metacentric radius:  BM = I / V  (m). */
export function metacentricRadius(beam: number, draft: number): number {
  const v = submergedArea(beam, draft);
  return v <= 1e-9 ? 0 : waterplaneInertia(beam) / v;
}

/** Metacentric height:  GM = KB + BM − KG  (m). Positive → stable. */
export function metacentricHeight(p: BoatParams): number {
  return centreOfBuoyancy(p.draft) + metacentricRadius(p.beam, p.draft) - p.kg;
}

/** Righting arm at a heel angle θ (deg):  GZ = GM · sin(θ)  (m). */
export function rightingArm(gm: number, heelDeg: number): number {
  return gm * Math.sin((heelDeg * Math.PI) / 180);
}

/** A complete readout of the stability geometry for a given boat. */
export interface StabilityReadout {
  kb: number;
  bm: number;
  gm: number;
  /** Height of the metacentre M above the keel:  KM = KB + BM. */
  km: number;
  /** Righting arm at the current heel slider angle (m). */
  gz: number;
  stable: boolean;
}

/** Resolve every stability quantity for a boat at its slider heel angle. */
export function stability(p: BoatParams): StabilityReadout {
  const kb = centreOfBuoyancy(p.draft);
  const bm = metacentricRadius(p.beam, p.draft);
  const gm = kb + bm - p.kg;
  return {
    kb,
    bm,
    gm,
    km: kb + bm,
    gz: rightingArm(gm, p.heel),
    stable: gm > 0,
  };
}

/** Bilingual status label for the headline result. */
export const stabilityLabel = (gm: number): string =>
  gm > 0 ? "เสถียร Stable" : "ไม่เสถียร Unstable";

/**
 * Horizontal shift of the centre of buoyancy B toward the low (immersed) side
 * when the hull is heeled. For small angles  BB' ≈ BM · tan(θ); the metacentre
 * is the point where the line of buoyant action meets the centreline. We return
 * the offset measured perpendicular to the centreline (m), clamped so the marker
 * stays inside the hull at large angles.
 */
export function buoyancyShift(bm: number, heelDeg: number, beam: number): number {
  const raw = bm * Math.tan((heelDeg * Math.PI) / 180);
  return clamp(raw, -beam / 2, beam / 2);
}

/** Mutable rocking state, persisted across frames in a ref. */
export interface HeelState {
  /** Current dynamic heel angle, in radians (offset around the slider angle). */
  angle: number;
  /** Angular velocity (rad/s). */
  omega: number;
}

/**
 * Advance the boat's free-rocking dynamics by `dt`.
 *
 * We integrate a small-angle restoring torque proportional to the righting arm
 * GZ(φ) = GM·sin(φ) about the *current heel slider angle* (`baseRad`), with light
 * damping so a stable boat oscillates and settles upright, while an unstable boat
 * (GM < 0) sees the "restoring" torque push it further over → it capsizes.
 *
 * `state.angle` is the dynamic offset added to the slider angle on the canvas.
 * Paused frames (dt = 0) freeze the motion. Returns a fresh HeelState.
 */
export function stepHeel(
  state: HeelState,
  params: { gm: number; baseRad: number },
  dt: number,
): HeelState {
  if (dt <= 0) return state;
  const dtc = Math.min(dt, 0.05); // guard against giant tab-switch steps
  const { gm, baseRad } = params;

  // Total tilt = slider base + dynamic offset. Torque ∝ −GM·sin(total) for a
  // pendulum-like restoring law (stiffness set by GM). A gentle visual gain maps
  // metres of GM onto a comfortable angular acceleration.
  const STIFFNESS = 6;
  const total = baseRad + state.angle;
  const torque = -STIFFNESS * gm * Math.sin(total);

  // Damping: stronger when stable so it visibly settles; weaker when capsizing
  // so the over-rotation reads clearly.
  const damping = gm > 0 ? 1.4 : 0.5;

  let omega = state.omega + torque * dtc;
  omega -= omega * damping * dtc;
  let angle = state.angle + omega * dtc;

  if (gm > 0) {
    // Stable: kill micro-jitter once essentially upright & still.
    if (Math.abs(angle) < 1e-3 && Math.abs(omega) < 1e-3) {
      angle = 0;
      omega = 0;
    }
  } else {
    // Unstable: let it roll right over, then stop once fully capsized so the
    // canvas doesn't spin forever.
    const limit = Math.PI / 2 - baseRad - 0.05;
    if (Math.abs(angle) > Math.abs(limit)) {
      angle = limit * Math.sign(angle || 1);
      omega = 0;
    }
  }

  return { angle, omega };
}
