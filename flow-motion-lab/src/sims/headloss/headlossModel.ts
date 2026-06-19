/**
 * Model for the Pipe Head Loss simulation.
 * A long horizontal pipe with a valve and an elbow. Energy is lost to wall
 * friction (major loss, distributed along the length) and to the fittings
 * (minor loss, concentrated as step-drops at the valve & bend). Wraps the pure
 * head-loss formulas from lib/fluidFormulas and adds the geometry + particle
 * helpers the canvas needs.
 */
import { majorHeadLoss, minorHeadLoss, velocityHead } from "@/lib/fluidFormulas";

export interface FlowParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Streamline fraction in [-0.82, 0.82] (share of pipe half-height). */
  f: number;
}

/** Normalised positions (fraction of length) of the two fittings. */
export const VALVE_XF = 0.4;
export const BEND_XF = 0.7;

/** Each fitting's share of the total minor loss coefficient K. */
export const VALVE_SHARE = 0.55;
export const BEND_SHARE = 0.45;

export interface HeadLossResult {
  /** Major (friction) head loss, m. */
  hf: number;
  /** Minor (fitting) head loss, m. */
  hm: number;
  /** Total head loss hf + hm, m. */
  total: number;
  /** Velocity head V²/2g, m. */
  vHead: number;
}

/** Compute every head-loss quantity from the live parameters. */
export function computeHeadLoss(
  f: number,
  L: number,
  D: number,
  V: number,
  K: number,
): HeadLossResult {
  const hf = majorHeadLoss(f, L, D, V);
  const hm = minorHeadLoss(K, V);
  return { hf, hm, total: hf + hm, vHead: velocityHead(V) };
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): FlowParticle[] {
  const out: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.82 });
  }
  return out;
}
