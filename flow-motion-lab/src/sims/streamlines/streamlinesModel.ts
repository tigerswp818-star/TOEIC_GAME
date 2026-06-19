/**
 * Model for the "Streamline · Pathline · Streakline" comparator
 * (Chapter: Fluid Kinematics).
 *
 * The hero idea: in a STEADY flow the three classic flow curves coincide, but in
 * an UNSTEADY (time-varying) flow they pull apart. We drive everything from a
 * deliberately simple flapping/oscillating 2-D velocity field:
 *
 *     u = U0
 *     v = A · sin(k·x − ω·t)
 *
 * With ω = 0 the field is steady (v depends only on x), so the instantaneous
 * direction field never changes and the streamline, the trajectory of one
 * marked particle (pathline) and the dye line of particles released from a
 * fixed point (streakline) all trace the same wavy curve. Turn ω up and the
 * field flaps in time → the three curves visibly separate.
 *
 * Coordinates here are abstract "world" units; the component scales them to
 * pixels. Pure functions + light helpers, no side effects.
 */

export interface FieldParams {
  /** Base horizontal speed U0 (world units / s). */
  u0: number;
  /** Transverse amplitude A. */
  amplitude: number;
  /** Angular frequency ω (rad / s). ω = 0 → steady flow. */
  omega: number;
  /** Spatial wavenumber k (rad / world unit). Fixed — not a user control. */
  k: number;
}

/** A 2-D velocity sample. */
export interface Velocity {
  vx: number;
  vy: number;
}

/** A point in world space, used for the pathline / streakline trails. */
export interface FlowPoint {
  x: number;
  y: number;
}

/** A single dye particle released from the injection point (streakline). */
export interface DyeParticle {
  x: number;
  y: number;
  /** Sim-time at which it was injected — older particles fade. */
  born: number;
}

/** Fixed spatial wavenumber for the flapping field. */
export const WAVENUMBER = 0.012;

/**
 * Time-varying velocity field  u = U0,  v = A·sin(k·x − ω·t).
 * When ω = 0 this is steady (depends on x only), so streamline = pathline =
 * streakline. With ω ≠ 0 the field flaps and the three curves separate.
 */
export function velocityAt(
  x: number,
  _y: number,
  t: number,
  params: FieldParams,
): Velocity {
  const { u0, amplitude, omega, k } = params;
  return {
    vx: u0,
    vy: amplitude * Math.sin(k * x - omega * t),
  };
}

/** True when the flow is steady (ω ≈ 0) → the three curves coincide. */
export function isSteady(omega: number): boolean {
  return Math.abs(omega) < 1e-6;
}

/**
 * Integrate a STREAMLINE: a curve everywhere tangent to the INSTANTANEOUS
 * velocity field, with time frozen at `t`. Steps forward by a fixed dx from a
 * seed point, following the local field direction. Returns world-space points.
 */
export function integrateStreamline(
  seed: FlowPoint,
  t: number,
  params: FieldParams,
  length: number,
  dx: number,
): FlowPoint[] {
  const pts: FlowPoint[] = [{ x: seed.x, y: seed.y }];
  let x = seed.x;
  let y = seed.y;
  let travelled = 0;
  let guard = 0;
  while (travelled < length && guard < 4000) {
    guard++;
    const { vx, vy } = velocityAt(x, y, t, params);
    const speed = Math.hypot(vx, vy);
    if (speed < 1e-6) break;
    // March a fixed arc-length dx along the unit flow direction.
    x += (vx / speed) * dx;
    y += (vy / speed) * dx;
    travelled += dx;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Advance ONE particle by one time-step, returning its new position. Used to
 * grow the pathline (the actual trajectory of a single marked particle).
 */
export function advectParticle(
  p: FlowPoint,
  t: number,
  dt: number,
  params: FieldParams,
): FlowPoint {
  const { vx, vy } = velocityAt(p.x, p.y, t, params);
  return { x: p.x + vx * dt, y: p.y + vy * dt };
}

/** Seed positions (world y) for the instantaneous streamline rake. */
export function streamlineSeeds(height: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push((height * (i + 1)) / (count + 1));
  }
  return out;
}

/**
 * Mode label helper for the result panel: returns the Thai/English regime name.
 */
export function modeLabel(omega: number): string {
  return isSteady(omega) ? "คงตัว (Steady)" : "ไม่คงตัว (Unsteady)";
}
