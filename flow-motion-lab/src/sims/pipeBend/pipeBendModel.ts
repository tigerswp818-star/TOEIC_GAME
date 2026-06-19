/**
 * Physics + geometry model for the Pipe Bend force simulation.
 *
 * Water flows through a bend that turns the flow by angle θ. Using a
 * control-volume momentum balance (assuming equal cross-sectional area, speed
 * and gauge pressure at the inlet and outlet), the resultant force the bend
 * must resist comes from both the pressure acting on the end faces and the
 * change in momentum flux of the fluid:
 *
 *   A    = circleArea(D)              cross-sectional area      (m²)
 *   Q    = A·V                        volumetric flow rate      (m³/s)
 *   ṁ    = ρ·Q                        mass flow rate            (kg/s)
 *   term = P·A + ρ·Q·V               pressure + momentum flux  (N)
 *   Fx   = term·(1 − cosθ)            x-component of force      (N)
 *   Fy   = term·sinθ                  y-component of force      (N)
 *   F    = hypot(Fx, Fy)             resultant force           (N)
 *   dir  = atan2(Fy, Fx)            direction of resultant    (rad)
 */
import { circleArea, flowRate } from "@/lib/fluidFormulas";
import { RHO_WATER } from "@/lib/constants";

export interface BendForce {
  /** Cross-sectional area A = π(D/2)²  (m²). */
  area: number;
  /** Volumetric flow rate Q = A·V  (m³/s). */
  q: number;
  /** Mass flow rate ṁ = ρ·Q  (kg/s). */
  mdot: number;
  /** Pressure + momentum-flux magnitude P·A + ρ·Q·V  (N). */
  term: number;
  /** Force x-component term·(1 − cosθ)  (N). */
  fx: number;
  /** Force y-component term·sinθ  (N). */
  fy: number;
  /** Resultant force magnitude hypot(Fx, Fy)  (N). */
  fResultant: number;
  /** Direction of the resultant force atan2(Fy, Fx)  (radians). */
  direction: number;
}

/**
 * Control-volume momentum balance for a pipe bend turning flow by `thetaDeg`.
 * Inputs are clamped to non-negative physical values so a mid-drag slider can
 * never yield NaN/Infinity.
 */
export function bendForce(
  v: number,
  d: number,
  p: number,
  thetaDeg: number,
  rho: number = RHO_WATER,
): BendForce {
  const vel = Math.max(v, 0);
  const area = circleArea(Math.max(d, 1e-6));
  const q = flowRate(area, vel);
  const mdot = rho * q;
  const term = Math.max(p, 0) * area + rho * q * vel;
  const theta = (thetaDeg * Math.PI) / 180;
  const fx = term * (1 - Math.cos(theta));
  const fy = term * Math.sin(theta);
  const fResultant = Math.hypot(fx, fy);
  const direction = Math.atan2(fy, fx);
  return { area, q, mdot, term, fx, fy, fResultant, direction };
}

/**
 * A particle that advects along the bend centreline path, parameterised by
 * arc-fraction s ∈ [0,1] from inlet to outlet.
 */
export interface BendParticle {
  /** Normalised arc position 0→1 along the bend centreline. */
  s: number;
  /** Lateral offset across the pipe in [-0.85, 0.85] (share of pipe radius). */
  off: number;
}

/** Seed a fresh set of particles spread along the bend path. */
export function seedParticles(count: number): BendParticle[] {
  const out: BendParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ s: Math.random(), off: (Math.random() * 2 - 1) * 0.85 });
  }
  return out;
}

/** A point on the bend centreline plus the local flow (tangent) direction. */
export interface PathPoint {
  x: number;
  y: number;
  /** Unit tangent (flow direction) at this point. */
  tx: number;
  ty: number;
  /** Unit normal (perpendicular to flow) at this point. */
  nx: number;
  ny: number;
}

/**
 * Centreline geometry of a 2-D bend in canvas pixels. The flow enters
 * horizontally from the left along a straight inlet leg, sweeps through a
 * circular arc that turns it by `thetaDeg`, then leaves along a straight outlet
 * leg. `s` is the normalised arc position 0→1 over the whole path.
 *
 * Screen y grows downwards; a positive turn angle bends the flow upward on
 * screen (toward smaller y) so the visual matches the +Fy arrow pointing up.
 */
export function bendPath(
  s: number,
  thetaDeg: number,
  cx: number,
  cy: number,
  legLen: number,
  radius: number,
): PathPoint {
  const theta = (thetaDeg * Math.PI) / 180;
  const arcLen = radius * theta; // length of the curved section
  const total = legLen * 2 + arcLen;
  const t = Math.min(Math.max(s, 0), 1) * total;

  // Inlet leg: horizontal, flowing in +x toward the bend start.
  const startX = cx - legLen;
  const startY = cy;
  // Arc centre sits "above" the bend start by `radius` (screen-up = -y).
  const arcCx = cx;
  const arcCy = cy - radius;

  if (t <= legLen) {
    return { x: startX + t, y: startY, tx: 1, ty: 0, nx: 0, ny: -1 };
  }
  if (t <= legLen + arcLen) {
    const a = (t - legLen) / Math.max(radius, 1e-6); // angle swept so far
    // Point on the arc: start at the bottom of the circle, sweep by `a`.
    const x = arcCx + radius * Math.sin(a);
    const y = arcCy + radius * Math.cos(a);
    const tx = Math.cos(a);
    const ty = -Math.sin(a);
    return { x, y, tx, ty, nx: -Math.sin(a), ny: -Math.cos(a) };
  }
  // Outlet leg: straight, along the final tangent direction.
  const endX = arcCx + radius * Math.sin(theta);
  const endY = arcCy + radius * Math.cos(theta);
  const tx = Math.cos(theta);
  const ty = -Math.sin(theta);
  const d = t - legLen - arcLen;
  return {
    x: endX + tx * d,
    y: endY + ty * d,
    tx,
    ty,
    nx: -Math.sin(theta),
    ny: -Math.cos(theta),
  };
}
