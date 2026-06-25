/**
 * Physics + presets for the Newtonian vs Non-Newtonian simulation.
 *
 * The flow behaviour of many fluids is captured by the Herschel–Bulkley
 * (power-law with yield stress) model relating shear stress τ to shear rate γ̇:
 *
 *      τ = τ₀ + K·γ̇ⁿ
 *
 * where
 *   τ₀ — yield stress (Pa): the fluid only flows once τ exceeds τ₀,
 *   K  — consistency index (Pa·sⁿ): "how thick" the fluid is,
 *   n  — flow behaviour index (dimensionless):
 *          n = 1 → Newtonian (constant viscosity),
 *          n < 1 → shear-thinning / pseudoplastic (gets thinner when stirred),
 *          n > 1 → shear-thickening / dilatant (gets thicker when stirred).
 *
 * The apparent (effective) viscosity is the ratio
 *
 *      μ_app = τ / γ̇   (guarded for γ̇ > 0)
 *
 * For Newtonian fluids μ_app is constant; for non-Newtonian fluids it changes
 * with γ̇, which is the whole point of the simulation.
 */

/** Shear stress τ from the power-law (+ yield) model. γ̇ in 1/s, τ in Pa. */
export function shearStress(gammaDot: number, k: number, n: number, tau0 = 0): number {
  const g = Math.max(gammaDot, 0);
  return tau0 + k * Math.pow(g, n);
}

/**
 * Apparent viscosity μ_app = τ / γ̇ (Pa·s). Guarded so γ̇ → 0 does not blow up;
 * we evaluate at a tiny floor instead of returning Infinity.
 */
export function apparentViscosity(gammaDot: number, k: number, n: number, tau0 = 0): number {
  const g = Math.max(gammaDot, 1e-6);
  return shearStress(g, k, n, tau0) / g;
}

/** A non-Newtonian fluid behaviour preset. */
export interface FluidType {
  id: string;
  /** Thai + English label, e.g. "น้ำ Water". */
  label: string;
  /** Short Thai tag drawn on the canvas. */
  tag: string;
  /** Behaviour family name (Thai + English) for the badge / readout. */
  behaviour: string;
  /** Consistency index K (Pa·sⁿ). */
  k: number;
  /** Flow behaviour index n (dimensionless). */
  n: number;
  /** Yield stress τ₀ (Pa). */
  tau0: number;
  /** Display colour (CSS) for particle layers & graph curve. */
  color: string;
}

/**
 * The fluid behaviour presets.
 *  - Newtonian: น้ำ Water (n = 1, τ₀ = 0) — straight τ–γ̇ line, μ constant.
 *  - Shear-thinning: ซอสมะเขือเทศ Ketchup (n < 1) — μ drops as γ̇ rises.
 *  - Shear-thickening: แป้งข้าวโพดผสมน้ำ Cornstarch (n > 1) — μ rises with γ̇.
 *  - Bingham plastic: ยาสีฟัน Toothpaste (τ₀ > 0, n = 1) — needs yield first.
 */
export const FLUID_TYPES: FluidType[] = [
  {
    id: "newtonian",
    label: "น้ำ Water",
    tag: "น้ำ",
    behaviour: "Newtonian (นิวโทเนียน)",
    k: 0.05,
    n: 1,
    tau0: 0,
    color: "#38bdf8",
  },
  {
    id: "shear-thinning",
    label: "ซอสมะเขือเทศ Ketchup",
    tag: "ซอส",
    behaviour: "Shear-thinning / Pseudoplastic (เจือจางเมื่อกวน)",
    k: 6,
    n: 0.4,
    tau0: 0,
    color: "#ef4444",
  },
  {
    id: "shear-thickening",
    label: "แป้งข้าวโพดผสมน้ำ Cornstarch",
    tag: "แป้ง",
    behaviour: "Shear-thickening / Dilatant (ข้นขึ้นเมื่อกวน)",
    k: 0.4,
    n: 1.6,
    tau0: 0,
    color: "#f59e0b",
  },
  {
    id: "bingham",
    label: "ยาสีฟัน Toothpaste",
    tag: "ยาสีฟัน",
    behaviour: "Bingham plastic (ต้องเกิน yield stress)",
    k: 0.3,
    n: 1,
    tau0: 18,
    color: "#a855f7",
  },
];

/** Custom (slider-driven) fluid colour used when the learner tweaks K and n. */
export const CUSTOM_COLOR = "#34d399";

/** Look up a preset index by id; -1 means "custom". */
export function typeIndexById(id: string): number {
  return FLUID_TYPES.findIndex((f) => f.id === id);
}

/** Slider / sweep bounds for the shear rate γ̇ (1/s). */
export const GAMMA_MIN = 0.1;
export const GAMMA_MAX = 100;

/**
 * Build a τ-vs-γ̇ curve over [GAMMA_MIN, GAMMA_MAX] for a fluid. Log-spaced in
 * γ̇ so the curvature of power-law fluids reads clearly across the decades.
 */
export function stressCurve(
  k: number,
  n: number,
  tau0: number,
  count = 48,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const g = GAMMA_MIN * Math.pow(GAMMA_MAX / GAMMA_MIN, i / (count - 1));
    out.push({ x: g, y: shearStress(g, k, n, tau0) });
  }
  return out;
}

/** A single particle inside the shear cell. */
export interface ShearParticle {
  /** Horizontal position fraction across the cell, 0→1. */
  xf: number;
  /** Vertical position fraction, 0 = bottom (fixed) → 1 = top (moving). */
  yf: number;
}

/**
 * Seed particles in horizontal layers across the shear cell. `layers` rows are
 * spread top-to-bottom; particles within a row are spread horizontally.
 */
export function seedShearParticles(layers: number, perLayer: number): ShearParticle[] {
  const out: ShearParticle[] = [];
  for (let r = 0; r < layers; r++) {
    const yf = layers > 1 ? r / (layers - 1) : 0.5;
    for (let c = 0; c < perLayer; c++) {
      out.push({ xf: (c + Math.random() * 0.6) / perLayer, yf });
    }
  }
  return out;
}

/**
 * Local horizontal velocity of fluid at height fraction yf for a simple Couette
 * (linear) velocity profile u(y) = γ̇·y. We return it in *relative* units so the
 * top-plate speed (yf = 1) scales directly with γ̇; the bottom (yf = 0) is the
 * no-slip wall and stays fixed at zero.
 */
export function layerVelocity(yf: number, gammaDot: number): number {
  return gammaDot * yf;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Plug-core fraction (0→1) for a yield-stress (Bingham/Herschel–Bulkley) fluid
 * in pressure-driven channel flow: the central band where the stress is below
 * τ₀ moves as a rigid plug. Ratio of yield stress to wall stress.
 */
export function plugFraction(tau0: number, k: number, n: number, gammaDot: number): number {
  if (tau0 <= 0) return 0;
  const tauWall = shearStress(Math.max(gammaDot, 1e-6), k, n, tau0);
  return clamp01(tau0 / tauWall) * 0.92;
}

/**
 * Normalised pressure-driven channel velocity profile (1 at centre, 0 at walls)
 * as a function of yn ∈ [-1, 1]. The SHAPE depends on the fluid:
 *   - Newtonian (n=1):     u = 1 − yn²            → parabola
 *   - Shear-thinning (n<1): exponent > 2          → blunt / plug-like
 *   - Shear-thickening (n>1): exponent < 2        → pointed
 *   - Yield stress:        flat rigid plug in |yn| ≤ plug, sheared shoulders
 */
export function channelProfile(yn: number, n: number, plug: number): number {
  const a = Math.min(1, Math.abs(yn));
  const m = (n + 1) / n; // power-law profile exponent
  if (plug > 0) {
    if (a <= plug) return 1;
    const t = (a - plug) / (1 - plug);
    return clamp01(1 - Math.pow(t, m));
  }
  return clamp01(1 - Math.pow(a, m));
}
