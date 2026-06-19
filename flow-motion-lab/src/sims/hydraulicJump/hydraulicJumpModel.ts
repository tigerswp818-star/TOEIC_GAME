/**
 * Physics + particle model for the Hydraulic Jump simulation (open channel).
 *
 * Supercritical (shallow, fast) flow abruptly transitions to subcritical
 * (deep, slow) flow through a turbulent roller that dissipates energy. All
 * formulas use SI units and guard against non-positive inputs so the live
 * sliders never produce NaN/Infinity.
 */
import { GRAVITY } from "@/lib/constants";

/** Result of the conjugate-depth analysis for an upstream state (y1, V1). */
export interface JumpResult {
  /** Upstream Froude number Fr₁ = V₁/√(g·y₁). */
  fr1: number;
  /** Conjugate (downstream) depth y₂ from the momentum equation (m). */
  y2: number;
  /** Downstream velocity from continuity V₂ = V₁·y₁/y₂ (m/s). */
  v2: number;
  /** Downstream Froude number Fr₂ = V₂/√(g·y₂). */
  fr2: number;
  /** Energy dissipated by the jump ΔE = (y₂−y₁)³ / (4·y₁·y₂) (m). */
  energyLoss: number;
  /** Conjugate-depth ratio y₂/y₁. */
  depthRatio: number;
  /** A jump only forms when the upstream flow is supercritical (Fr₁ > 1). */
  jumpForms: boolean;
}

/** Upstream Froude number Fr₁ = V₁/√(g·y₁). */
export function froudeNumber(v: number, y: number): number {
  const yy = Math.max(y, 1e-6);
  return v / Math.sqrt(GRAVITY * yy);
}

/**
 * Conjugate (sequent) depth ratio from the momentum equation across a jump:
 *   y₂/y₁ = ½(√(1 + 8·Fr₁²) − 1)
 */
export function depthRatio(fr1: number): number {
  return 0.5 * (Math.sqrt(1 + 8 * fr1 * fr1) - 1);
}

/** Full hydraulic-jump analysis for upstream depth y₁ and velocity V₁. */
export function computeJump(y1: number, v1: number): JumpResult {
  const y1s = Math.max(y1, 1e-6);
  const v1s = Math.max(v1, 1e-6);
  const fr1 = froudeNumber(v1s, y1s);
  const ratio = depthRatio(fr1);
  const y2 = ratio * y1s;
  // Continuity: V₂ = V₁·y₁/y₂.
  const v2 = (v1s * y1s) / Math.max(y2, 1e-6);
  const fr2 = froudeNumber(v2, y2);
  // Energy loss across the jump ΔE = (y₂−y₁)³ / (4·y₁·y₂).
  const energyLoss = Math.max(
    0,
    Math.pow(y2 - y1s, 3) / Math.max(4 * y1s * y2, 1e-6),
  );
  return {
    fr1,
    y2,
    v2,
    fr2,
    energyLoss,
    depthRatio: ratio,
    jumpForms: fr1 > 1,
  };
}

/** A particle floating along the channel, left → right. */
export interface JumpParticle {
  /** Normalised horizontal position 0→1 across the channel. */
  xf: number;
  /** Streamline fraction in [-1, 1] (share of local water column). */
  f: number;
  /** Per-particle random phase so the turbulent jitter looks uncorrelated. */
  seed: number;
}

/** Seed a fresh set of particles spread across the channel. */
export function seedParticles(count: number): JumpParticle[] {
  const out: JumpParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      f: Math.random() * 2 - 1,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/** Where along the channel (normalised) the jump/roller sits. */
export const JUMP_XF = 0.5;
/** Half-width (normalised) of the turbulent roller band around JUMP_XF. */
export const ROLLER_HALF = 0.1;
