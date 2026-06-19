/**
 * Physics + geometry model for the Pump Affinity Laws simulation.
 *
 * Changing a pump's rotational speed N scales its performance by the
 * affinity (similarity) laws — for a fixed impeller diameter:
 *   • Flow:   Q ∝ N          →  Q = Q0·(N/N0)
 *   • Head:   H ∝ N²         →  H = H0·(N/N0)²
 *   • Power:  P ∝ N³         →  P = P0·(N/N0)³
 *
 * A single reference operating point (Q0, H0, P0) is measured at the rated
 * speed N0; every other speed is obtained purely by scaling. Power is the most
 * sensitive (cube law), which is why trimming speed a little saves a lot of
 * energy. All helpers guard against negatives so a mid-drag slider value can
 * never produce NaN/Infinity.
 */

/** Reference (rated) pump speed, in % of rated (N0). */
export const N_REF = 100;

/** Reference flow rate Q0 at the rated speed N0 (m³/s). */
export const Q0_REF = 0.4;
/** Reference head H0 at the rated speed N0 (m). */
export const H0_REF = 32;
/** Reference shaft power P0 at the rated speed N0 (W). */
export const P0_REF = 150000; // 150 kW

/** Speed ratio r = N / N0 (clamped ≥ 0). */
export function speedRatio(n: number): number {
  return Math.max(n, 0) / N_REF;
}

/** Flow at speed N: Q = Q0·(N/N0). */
export function affinityFlow(n: number): number {
  return Q0_REF * speedRatio(n);
}

/** Head at speed N: H = H0·(N/N0)². */
export function affinityHead(n: number): number {
  const r = speedRatio(n);
  return H0_REF * r * r;
}

/** Shaft power at speed N: P = P0·(N/N0)³ (W). */
export function affinityPower(n: number): number {
  const r = speedRatio(n);
  return P0_REF * r * r * r;
}

export interface AffinityResult {
  /** Speed ratio N/N0 (dimensionless). */
  ratio: number;
  /** Flow rate at speed N, m³/s. */
  q: number;
  /** Head at speed N, m. */
  h: number;
  /** Shaft power at speed N, W. */
  power: number;
}

/** Full affinity-scaled operating point at speed N (% of rated). */
export function affinityPoint(n: number): AffinityResult {
  return {
    ratio: speedRatio(n),
    q: affinityFlow(n),
    h: affinityHead(n),
    power: affinityPower(n),
  };
}

/**
 * The pump's head–flow characteristic at a given speed, modelled as a parabola
 * through its own affinity-scaled operating point:
 *   H_pump(Q) = H0(N) − a(N)·Q²
 * where the shut-off head H0(N) and the slope a(N) are chosen so the curve
 * passes through (Q(N), H(N)) and shifts up/down with N. We keep the shut-off
 * head proportional to N² and pin the slope so the operating point lands on the
 * curve, giving a family of parabolas that fan out as N rises.
 */
export function pumpHeadAt(q: number, n: number): number {
  const r = speedRatio(n);
  const shutoff = H0_REF * 1.6 * r * r; // shut-off head ∝ N²
  const qOp = affinityFlow(n);
  const hOp = affinityHead(n);
  // a from H0 − a·qOp² = hOp  (qOp > 0 since Q0_REF > 0)
  const a = qOp > 1e-9 ? (shutoff - hOp) / (qOp * qOp) : 0;
  return Math.max(shutoff - a * q * q, 0);
}

/**
 * Sample one pump curve over [0, qMax] for the Q–H chart.
 * Returns an array of {x: Q, y: H} points.
 */
export function sampleCurve(
  n: number,
  qMax: number,
  steps = 48,
): { x: number; y: number }[] {
  const span = Math.max(qMax, 1e-6);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = (i / steps) * span;
    out.push({ x: q, y: pumpHeadAt(q, n) });
  }
  return out;
}

/**
 * A sensible upper bound for the Q axis: the free-delivery flow of the pump at
 * the highest slider speed (130%), padded a little so the operating point and
 * both curves sit comfortably inside the chart.
 */
export function maxFlow(): number {
  return affinityFlow(130) * 1.12;
}

/**
 * A sensible upper bound for the H axis: the shut-off head at the highest
 * slider speed (130%), padded so curves don't clip at the top.
 */
export function maxHead(): number {
  return pumpHeadAt(0, 130) * 1.08;
}

/**
 * Invert the affinity laws to find the speed N (% of rated) that yields a
 * target performance value. Used by Guided/Challenge hints.
 *   • from a target flow:  N = N0·(Q/Q0)
 *   • from a target head:  N = N0·sqrt(H/H0)
 *   • from a target power: N = N0·cbrt(P/P0)
 */
export function speedForFlow(q: number): number {
  return N_REF * (Math.max(q, 0) / Q0_REF);
}
export function speedForHead(h: number): number {
  return N_REF * Math.sqrt(Math.max(h, 0) / H0_REF);
}
export function speedForPower(p: number): number {
  return N_REF * Math.cbrt(Math.max(p, 0) / P0_REF);
}

export interface AffinityParticle {
  /** Normalised horizontal position 0→1 along the discharge pipe. */
  xf: number;
  /** Streamline fraction in [-0.8, 0.8] (share of pipe half-height). */
  f: number;
}

/** Seed a fresh set of particles spread along the discharge pipe. */
export function seedParticles(count: number): AffinityParticle[] {
  const out: AffinityParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.8 });
  }
  return out;
}

/** Normalised x position of the pump body on the stage. */
export const PUMP_XF = 0.18;
