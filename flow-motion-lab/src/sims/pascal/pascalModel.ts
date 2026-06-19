/**
 * Pure physics + geometry helpers for the Pascal's Law hydraulic-press sim.
 *
 * A closed, incompressible fluid connects a small piston (area A1) and a large
 * piston (area A2). Pascal's principle says the pressure transmitted through the
 * fluid is the same everywhere:
 *
 *   P = F1 / A1 = F2 / A2   →   F2 = F1 · A2 / A1
 *
 * The mechanical advantage is the area ratio MA = A2 / A1, and volume
 * conservation links the strokes: A1·d1 = A2·d2  →  d2 = d1 · A1 / A2.
 *
 * All functions are side-effect free and operate in SI units (areas converted
 * from cm² to m²) so the React layer can call them safely each frame. Every
 * division guards its denominator to stay finite for any slider value > 0.
 */

/** Convert an area in square centimetres to square metres (1 cm² = 1e-4 m²). */
export const cm2ToM2 = (cm2: number): number => Math.max(cm2, 0) * 1e-4;

/**
 * System pressure transmitted through the fluid: P = F1 / A1.
 * `f1` in newtons, `a1Cm2` in cm². Returns pascals (Pa).
 */
export function systemPressure(f1: number, a1Cm2: number): number {
  const a1 = cm2ToM2(a1Cm2);
  return f1 / Math.max(a1, 1e-9);
}

/**
 * Output force on the large piston: F2 = P · A2 = F1 · A2 / A1.
 * Areas in cm² (ratio is unit-independent). Returns newtons (N).
 */
export function outputForce(f1: number, a1Cm2: number, a2Cm2: number): number {
  return f1 * (a2Cm2 / Math.max(a1Cm2, 1e-9));
}

/** Mechanical advantage MA = A2 / A1 (dimensionless, "×"). */
export const mechanicalAdvantage = (a1Cm2: number, a2Cm2: number): number =>
  a2Cm2 / Math.max(a1Cm2, 1e-9);

/**
 * Stroke ratio of the large piston to the small piston from volume
 * conservation: d2 / d1 = A1 / A2. Returns the large-piston travel as a
 * fraction of the small-piston travel (≤ 1 when A2 > A1).
 */
export const strokeRatioLargeOverSmall = (a1Cm2: number, a2Cm2: number): number =>
  a1Cm2 / Math.max(a2Cm2, 1e-9);

/**
 * Stroke ratio of the small piston to the large piston: d1 / d2 = A2 / A1.
 * This equals the mechanical advantage — pressing the small piston far moves
 * the large one only a little, the price paid for the force gain.
 */
export const strokeRatioSmallOverLarge = (a1Cm2: number, a2Cm2: number): number =>
  a2Cm2 / Math.max(a1Cm2, 1e-9);
