/**
 * Physics + geometry for the Dam Pressure & Center of Pressure simulation.
 *
 * Side view of a rectangular gate (possibly inclined by an angle θ from
 * vertical) holding back still water of depth H. Hydrostatic pressure grows
 * linearly with depth, P(depth) = ρ·g·depth, so the pressure on the gate forms
 * a TRIANGULAR distribution: 0 at the surface → ρgH at the bottom.
 *
 * For a vertical gate spanning the full depth from the surface:
 *   • Resultant force   F = ½·ρ·g·H²·w
 *   • Centroid depth    y_c = H/2     (centroid of the wetted gate area)
 *   • Center of pressure y_cp = (2/3)·H  (below mid-depth, toward the bottom)
 *
 * General (prismatic surface) result used here:
 *   F  = ρ·g·h_c·A           where h_c is the VERTICAL depth of the centroid
 *   y_cp = y_c + I_xc / (y_c · A)   (distances measured ALONG the gate plane)
 *
 * For an inclined rectangular gate of slant length L and width w that starts at
 * the surface, the wetted depth is H = L·cos θ. Measuring distance s ALONG the
 * gate from the surface (so vertical depth = s·cos θ):
 *   A      = L · w
 *   s_c    = L / 2                          (centroid along the plane)
 *   h_c    = s_c · cos θ = H / 2            (vertical centroid depth)
 *   I_xc   = w · L³ / 12                    (second moment about centroidal axis)
 *   s_cp   = s_c + I_xc / (s_c · A) = (2/3)·L
 *   h_cp   = s_cp · cos θ = (2/3)·H         (vertical CoP depth — same as vertical gate)
 *
 * All functions are pure and SI; the resultant always acts at 2/3 of the depth
 * for a triangular distribution, which is why a dam's base must be thicker than
 * its crest.
 */
import { hydrostaticPressure } from "@/lib/fluidFormulas";

/** Convert degrees to radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Local hydrostatic (gauge) pressure at a vertical depth (m). P = ρ·g·depth. */
export function pressureAtDepth(depth: number, rho: number, g: number): number {
  return hydrostaticPressure(rho, depth, g);
}

/** Maximum pressure on the gate — at the bottom, depth = H (Pa). */
export function maxPressure(rho: number, g: number, h: number): number {
  return hydrostaticPressure(rho, Math.max(h, 0), g);
}

/** Slant length of the wetted gate along its plane: L = H / cos θ (m). */
export function gateSlantLength(h: number, angleDeg: number): number {
  const c = Math.cos(degToRad(angleDeg));
  return Math.max(h, 0) / Math.max(c, 1e-6);
}

/** Wetted gate area A = L·w = (H/cos θ)·w (m²). */
export function gateArea(h: number, w: number, angleDeg: number): number {
  return gateSlantLength(h, angleDeg) * Math.max(w, 0);
}

/** Vertical depth of the gate's centroid: h_c = H/2 (m). */
export function centroidDepth(h: number): number {
  return Math.max(h, 0) / 2;
}

/**
 * Resultant hydrostatic force on the gate (N).
 * General form F = ρ·g·h_c·A. For an inclined gate from the surface this
 * reduces to F = ½·ρ·g·H²·w / cos θ — the slant area grows as the gate tilts.
 */
export function resultantForce(
  rho: number,
  g: number,
  h: number,
  w: number,
  angleDeg: number,
): number {
  const hc = centroidDepth(h);
  const a = gateArea(h, w, angleDeg);
  return hydrostaticPressure(rho, hc, g) * a;
}

/**
 * Vertical depth of the center of pressure (m).
 * Using y_cp = y_c + I_xc/(y_c·A) measured along the plane, then projecting to
 * the vertical: for a rectangle from the surface this is exactly (2/3)·H,
 * independent of the tilt angle.
 */
export function centerOfPressureDepth(h: number): number {
  return (2 / 3) * Math.max(h, 0);
}

/**
 * Distance of the center of pressure measured ALONG the gate plane, from the
 * surface (m): s_cp = (2/3)·L. Used when placing the resultant arrow on a
 * tilted gate.
 */
export function centerOfPressureSlant(h: number, angleDeg: number): number {
  return (2 / 3) * gateSlantLength(h, angleDeg);
}
