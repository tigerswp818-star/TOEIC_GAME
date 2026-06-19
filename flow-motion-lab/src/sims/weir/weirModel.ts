/**
 * Physics + particle model for the Weir (ฝายน้ำล้น) flow-measurement sim.
 *
 * A weir measures open-channel flow from the head H over the crest:
 *   Rectangular weir:  Q = Cd·(2/3)·√(2g)·b·H^(3/2)
 *   V-notch (triangular) weir:  Q = Cd·(8/15)·√(2g)·tan(θ/2)·H^(5/2)
 *
 * Q ∝ H^1.5 (rectangular) vs Q ∝ H^2.5 (V-notch). The V-notch is steeper in H,
 * so a small head change makes a large Q change — i.e. it is less sensitive to
 * flow and better at resolving low flows.
 *
 * Every helper guards its inputs to stay > 0 so the renderer never feeds NaN to
 * the canvas.
 */
import { GRAVITY } from "@/lib/constants";

export type WeirType = "rectangular" | "vnotch";

/** Typical discharge coefficients. */
export const CD_RECTANGULAR = 0.62;
export const CD_VNOTCH = 0.58;

/** Discharge coefficient Cd for the active weir type. */
export function weirCd(type: WeirType): number {
  return type === "vnotch" ? CD_VNOTCH : CD_RECTANGULAR;
}

/** Power exponent of H in the discharge law (1.5 rectangular, 2.5 V-notch). */
export function weirExponent(type: WeirType): number {
  return type === "vnotch" ? 2.5 : 1.5;
}

/** Rectangular weir discharge Q = Cd·(2/3)·√(2g)·b·H^(3/2). */
export function rectangularFlow(h: number, b: number): number {
  const head = Math.max(h, 0);
  const width = Math.max(b, 1e-6);
  return CD_RECTANGULAR * (2 / 3) * Math.sqrt(2 * GRAVITY) * width * Math.pow(head, 1.5);
}

/** V-notch (triangular) weir discharge Q = Cd·(8/15)·√(2g)·tan(θ/2)·H^(5/2). */
export function vnotchFlow(h: number, thetaDeg: number): number {
  const head = Math.max(h, 0);
  const theta = clampAngleDeg(thetaDeg);
  const tanHalf = Math.tan((theta * Math.PI) / 180 / 2);
  return CD_VNOTCH * (8 / 15) * Math.sqrt(2 * GRAVITY) * Math.max(tanHalf, 1e-6) * Math.pow(head, 2.5);
}

/** Keep the notch angle in a sensible, strictly-positive range (deg). */
function clampAngleDeg(thetaDeg: number): number {
  return Math.min(170, Math.max(1, thetaDeg));
}

/** Discharge for either weir type (guards inputs > 0). */
export function weirFlow(type: WeirType, h: number, b: number, thetaDeg: number): number {
  return type === "vnotch" ? vnotchFlow(h, thetaDeg) : rectangularFlow(h, b);
}

export interface WeirResult {
  /** Volumetric flow rate Q (m³/s). */
  flow: number;
  /** Discharge coefficient Cd used. */
  cd: number;
  /** Power exponent of H (1.5 or 2.5). */
  exponent: number;
}

/** Solve the active weir in one pass (all guarded > 0). */
export function computeWeir(
  type: WeirType,
  h: number,
  b: number,
  thetaDeg: number,
): WeirResult {
  return {
    flow: weirFlow(type, h, b, thetaDeg),
    cd: weirCd(type),
    exponent: weirExponent(type),
  };
}

/**
 * A particle of water spilling over the crest. It travels along the channel
 * toward the crest, accelerates over the edge and falls as a nappe.
 */
export interface WeirParticle {
  /** Normalised horizontal position 0→1 across the canvas. */
  xf: number;
  /** Streamline fraction in [0,1] (share of the pool depth / nappe spread). */
  f: number;
  /** Phase seed for slight randomisation of the nappe trajectory. */
  seed: number;
}

/** Seed particles spread across the upstream pool and over the crest. */
export function seedParticles(count: number): WeirParticle[] {
  const out: WeirParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: Math.random(), seed: Math.random() });
  }
  return out;
}
