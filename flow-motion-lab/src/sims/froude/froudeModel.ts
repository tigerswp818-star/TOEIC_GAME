/**
 * Physics + particle model for the Froude Number simulation (open channel).
 *
 * The Froude number compares the flow speed V to the speed of a shallow-water
 * surface (gravity) wave, the wave celerity c = √(g·y):
 *   Fr = V / √(g·y) = V / c
 *
 *   Fr < 1  Subcritical   — V < c, surface waves can travel UPSTREAM.
 *   Fr = 1  Critical      — V = c, waves stand still at the source.
 *   Fr > 1  Supercritical — V > c, every wave is swept DOWNSTREAM (wedge),
 *                            directly analogous to the Mach cone.
 *
 * Every helper guards its inputs to stay > 0 so the renderer never divides by
 * zero or feeds NaN to the canvas. SI units throughout.
 */
import { GRAVITY } from "@/lib/constants";

/** Flow regime classified from the Froude number. */
export type FroudeRegime = "subcritical" | "critical" | "supercritical";

/** Result of a single Froude analysis for a flow state (V, y). */
export interface FroudeResult {
  /** Froude number Fr = V/√(g·y). */
  fr: number;
  /** Shallow-water wave celerity c = √(g·y) (m/s). */
  celerity: number;
  /** Flow velocity carried through for display (m/s). */
  velocity: number;
  /** Water depth carried through for display (m). */
  depth: number;
  /** The classified regime. */
  regime: FroudeRegime;
}

/** Shallow-water wave celerity c = √(g·y). */
export function celerity(y: number): number {
  return Math.sqrt(GRAVITY * Math.max(y, 1e-6));
}

/** Froude number Fr = V / √(g·y) = V / c. */
export function froude(v: number, y: number): number {
  return Math.max(v, 0) / celerity(y);
}

/**
 * Classify the flow regime from the Froude number. A small tolerance band
 * around 1 is treated as Critical so the visual "wave pile-up" reads cleanly.
 */
export function froudeRegime(fr: number): FroudeRegime {
  if (fr > 1.0 + 0.03) return "supercritical";
  if (fr < 1.0 - 0.03) return "subcritical";
  return "critical";
}

/** Thai-first labels for each regime (with the English term and Fr range). */
export const REGIME_LABEL_TH: Record<FroudeRegime, string> = {
  subcritical: "ใต้วิกฤต Subcritical (Fr<1)",
  critical: "วิกฤต Critical (Fr≈1)",
  supercritical: "เหนือวิกฤต Supercritical (Fr>1)",
};

/** Short Thai descriptor of the flow character for each regime. */
export const REGIME_DESC_TH: Record<FroudeRegime, string> = {
  subcritical: "ไหลช้า น้ำลึก — คลื่นผิวน้ำเดินทวนน้ำขึ้นต้นน้ำได้",
  critical: "จุดวิกฤต — คลื่นนิ่งกองอยู่ที่จุดกำเนิด",
  supercritical: "ไหลเร็ว น้ำตื้น — คลื่นทุกลูกถูกพัดลงท้ายน้ำ (เป็นรูปลิ่ม)",
};

/** English regime string for the ResultStat readout. */
export const REGIME_EN: Record<FroudeRegime, string> = {
  subcritical: "Subcritical",
  critical: "Critical",
  supercritical: "Supercritical",
};

/** Adaptive ExplanationPanel tone for each regime. */
export const REGIME_TONE: Record<FroudeRegime, "cyan" | "amber" | "rose"> = {
  subcritical: "cyan",
  critical: "amber",
  supercritical: "rose",
};

/** Solve every Froude quantity in one pass (all guarded > 0). */
export function computeFroude(v: number, y: number): FroudeResult {
  const c = celerity(y);
  const fr = Math.max(v, 0) / c;
  return {
    fr,
    celerity: c,
    velocity: v,
    depth: y,
    regime: froudeRegime(fr),
  };
}

/** A single particle carried along the channel left → right. */
export interface FroudeParticle {
  /** Normalised horizontal position 0→1 along the channel. */
  xf: number;
  /** Depth fraction in [0,1]: 0 = channel bed, 1 = water surface. */
  df: number;
}

/** Seed particles spread across the channel length and depth. */
export function seedParticles(count: number): FroudeParticle[] {
  const out: FroudeParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), df: Math.random() });
  }
  return out;
}

/**
 * An expanding surface-wave ring emitted by the periodic disturbance ("stone").
 * Born at the source position, it grows in radius at the wave celerity c while
 * its centre is advected downstream with the flow at speed V — so the ring's
 * upstream edge moves at (V − c) and its downstream edge at (V + c). This is
 * exactly what produces the subcritical / critical / supercritical patterns.
 */
export interface WaveRing {
  /** Normalised x of the ring centre at birth (the disturbance source). */
  x0: number;
  /** Age in seconds since the ring was emitted (accumulated via dt). */
  age: number;
}
