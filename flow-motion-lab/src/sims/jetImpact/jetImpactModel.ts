/**
 * Physics + particle model for the "Water Jet Impact" simulation.
 *
 * A horizontal jet of water leaves a nozzle and strikes a target. The force on
 * the target comes entirely from the rate of change of the fluid's momentum
 * (F = ṁ·ΔV). All formulas are pure, SI units, and guard against non-physical
 * (≤ 0) input so a mid-drag slider value can never produce NaN/Infinity.
 *
 * Three target shapes change which momentum-change formula applies:
 *   • flat-normal   — flat plate at right angles to the jet  → F = ρ·Q·V
 *   • inclined-flat — flat plate at angle θ to the jet       → F_n = ρ·Q·V·sinθ
 *   • curved-vane   — vane that turns the jet by angle β     → Fx = ρ·Q·V·(1−cosβ)
 */

export type TargetKind = "flat-normal" | "inclined-flat" | "curved-vane";

const safe = (v: number, min = 1e-9): number =>
  Number.isFinite(v) ? Math.max(v, min) : min;

/** Convert degrees → radians. */
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Jet cross-sectional area from diameter: A = π d² / 4  (m²). */
export const jetArea = (d: number): number => Math.PI * safe(d) * safe(d) * 0.25;

/** Volumetric flow rate Q = A · V  (m³/s). */
export const flowRate = (area: number, velocity: number): number =>
  area * Math.max(velocity, 0);

/** Mass flow rate ṁ = ρ · Q  (kg/s). */
export const massFlow = (rho: number, q: number): number => rho * Math.max(q, 0);

/**
 * Impact force (N) for a flat plate held normal to the jet:
 *   F = ρ·Q·V  ( = ρ·A·V² ). The jet is brought to rest in the x-direction,
 *   so the whole x-momentum flux ṁ·V is delivered as force.
 */
export const forceFlatNormal = (rho: number, q: number, v: number): number =>
  rho * Math.max(q, 0) * Math.max(v, 0);

/**
 * Normal force (N) on a flat plate inclined at angle θ (deg) to the jet axis:
 *   F_n = ρ·Q·V·sinθ. At θ = 90° this reduces to the normal-plate case.
 */
export const forceInclined = (
  rho: number,
  q: number,
  v: number,
  thetaDeg: number,
): number => rho * Math.max(q, 0) * Math.max(v, 0) * Math.sin(toRad(thetaDeg));

/**
 * Force in the jet direction (N) on a curved/deflector vane that turns the jet
 * by angle β (deg):  Fx = ρ·Q·V·(1 − cosβ). A β = 180° vane reverses the jet
 * and gives 2·ρ·Q·V — twice the flat plate.
 */
export const forceCurvedVane = (
  rho: number,
  q: number,
  v: number,
  betaDeg: number,
): number => rho * Math.max(q, 0) * Math.max(v, 0) * (1 - Math.cos(toRad(betaDeg)));

/**
 * Dispatch to the matching force formula for the chosen target shape. `angleDeg`
 * is the plate angle θ for the inclined plate, or the turn angle β for the vane;
 * it is ignored for the flat-normal plate.
 */
export const impactForce = (
  kind: TargetKind,
  rho: number,
  q: number,
  v: number,
  angleDeg: number,
): number => {
  switch (kind) {
    case "inclined-flat":
      return forceInclined(rho, q, v, angleDeg);
    case "curved-vane":
      return forceCurvedVane(rho, q, v, angleDeg);
    case "flat-normal":
    default:
      return forceFlatNormal(rho, q, v);
  }
};

/** A particle of water in the jet, in normalised canvas coordinates. */
export interface JetParticle {
  /** Position 0→1 along the canvas width (and used as travel progress). */
  xf: number;
  /** Vertical offset within the jet stream, in [-1, 1] (× jet half-width). */
  off: number;
  /**
   * Deflection lane assigned at impact: which way the particle peels off the
   * target. For a flat-normal plate it splits up (+1) or down (−1); for a vane
   * it follows the curve. Set lazily on the first frame past the impact plane.
   */
  lane: 1 | -1;
  /** Whether this particle has already passed the impact plane this lap. */
  hit: boolean;
}

/** Seed a fresh jet of particles staggered along the stream. */
export const seedJet = (count: number): JetParticle[] => {
  const out: JetParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      off: Math.random() * 2 - 1,
      lane: Math.random() < 0.5 ? 1 : -1,
      hit: false,
    });
  }
  return out;
};
