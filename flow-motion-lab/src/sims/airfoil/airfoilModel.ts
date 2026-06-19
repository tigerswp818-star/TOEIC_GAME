/**
 * Model for the "Airfoil Lift Concept" simulation (Chapter: External Flow).
 *
 * IMPORTANT: this is a *simplified, conceptual* educational model — NOT a CFD
 * solver. The goal is to convey the intuition behind lift:
 *   air over the top accelerates → lower pressure (suction) above,
 *   slower / higher pressure below → a net upward force (lift).
 *
 * Lift coefficient follows thin-airfoil theory C_L ≈ 2π·α (α in radians), with a
 * gentle cap and a STALL model: beyond a stall angle (~15°) the boundary layer
 * separates, lift drops and drag jumps. Numbers are physically flavoured but
 * intentionally smoothed for teaching, so treat them as illustrative.
 */
import { clamp, lerp, smoothstep } from "@/lib/math";

/** Degrees → radians. */
const DEG = Math.PI / 180;

/** Angle (deg) at which the airfoil begins to stall. */
export const STALL_ANGLE_DEG = 15;
/** Angle (deg) by which lift has fully collapsed into the stalled regime. */
export const STALL_END_DEG = 22;

/**
 * Lift coefficient C_L as a function of angle of attack (degrees), using
 * thin-airfoil theory C_L = 2π·α (α in radians) up to stall, then a smooth
 * post-stall drop. Returned value is dimensionless.
 *
 * Below the stall angle the curve is the familiar straight line ~0.11 per degree
 * (2π·DEG). At α = STALL_ANGLE_DEG it peaks near C_L,max, then `smoothstep` rolls
 * it down toward a low separated-flow value past STALL_END_DEG.
 */
export function liftCoefficient(alphaDeg: number): number {
  const clMax = 2 * Math.PI * STALL_ANGLE_DEG * DEG; // peak at stall onset
  // Attached-flow (linear) lift, also valid for small negative α.
  const linear = 2 * Math.PI * alphaDeg * DEG;
  if (alphaDeg <= STALL_ANGLE_DEG) return linear;
  // Post-stall: separated flow → lift collapses toward a low residual.
  const drop = smoothstep(STALL_ANGLE_DEG, STALL_END_DEG, alphaDeg); // 0→1
  const residual = clMax * 0.45; // turbulent, separated wing still makes some lift
  return lerp(clMax, residual, drop);
}

/** True when the current angle of attack is in the stalled regime. */
export function isStalled(alphaDeg: number): boolean {
  return alphaDeg > STALL_ANGLE_DEG;
}

/**
 * Lift force F_L = ½·ρ·V²·C_L·A  (SI, Newtons).
 * `area` is a reference planform area (m²); kept simple for the visualization.
 */
export function liftForce(
  rho: number,
  v: number,
  clValue: number,
  area: number,
): number {
  return 0.5 * rho * v * v * clValue * area;
}

/**
 * A simple drag coefficient that rises with angle of attack and jumps at stall.
 * Dimensionless and illustrative: a small parasitic floor, an induced term that
 * grows with α², and a large separation penalty once the wing stalls.
 */
export function dragCoefficient(alphaDeg: number): number {
  const aRad = alphaDeg * DEG;
  const parasitic = 0.02; // skin-friction / form drag floor
  const induced = 0.9 * aRad * aRad; // induced drag ~ C_L² ~ α²
  // Separation penalty ramps in across the stall band — a clear "jump".
  const separation = 0.6 * smoothstep(STALL_ANGLE_DEG, STALL_END_DEG, alphaDeg);
  return parasitic + induced + separation;
}

/**
 * How separated / turbulent the flow over the top is, in [0, 1].
 * 0 = fully attached, 1 = fully separated (deep stall). Drives the wake/turbulence
 * visualization over the upper surface.
 */
export function separation(alphaDeg: number): number {
  return clamp(smoothstep(STALL_ANGLE_DEG - 1, STALL_END_DEG, alphaDeg), 0, 1);
}

/**
 * A points-list outline of an airfoil in a local frame (chord along +x, centred
 * at the origin), with a rounded leading edge at left and a sharp trailing edge
 * at right. `chord` sets the length; `thickness` is the relative max thickness
 * (e.g. 0.12). The caller rotates/translates this by the angle of attack.
 *
 * Uses a NACA-like symmetric thickness distribution so the shape reads as a real
 * wing section. Returns the upper surface (LE→TE) followed by the lower surface
 * (TE→LE) for a closed loop.
 */
export function airfoilOutline(
  chord: number,
  thickness: number,
  samples = 28,
): { x: number; y: number }[] {
  const t = thickness; // relative max thickness
  // NACA 00xx half-thickness as a function of chord fraction xc ∈ [0,1].
  const half = (xc: number): number =>
    (t * chord) *
    (1.4845 * Math.sqrt(xc) -
      0.63 * xc -
      1.758 * xc * xc +
      1.4215 * xc * xc * xc -
      0.5075 * xc * xc * xc * xc);

  const upper: { x: number; y: number }[] = [];
  const lower: { x: number; y: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const xc = i / samples; // 0 (LE) → 1 (TE)
    const x = (xc - 0.5) * chord; // centre the chord on the origin
    const yh = half(xc);
    upper.push({ x, y: -yh }); // screen y is down → top surface is negative
    lower.push({ x, y: yh });
  }
  // Upper LE→TE, then lower TE→LE → closed contour with a sharp trailing edge.
  return [...upper, ...lower.reverse()];
}
