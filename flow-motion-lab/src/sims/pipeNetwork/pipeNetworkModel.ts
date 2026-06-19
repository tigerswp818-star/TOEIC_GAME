/**
 * Physics + particle model for the Pipes in Series & Parallel simulation.
 *
 * Two pipes (1 and 2), each with its own diameter D and a shared friction
 * factor f and length L, are arranged either in SERIES or in PARALLEL. The
 * Darcy head-loss law for one pipe is
 *
 *   h = f (L/D)(V²/2g)   with   V = Q / A,   A = π D² / 4
 *
 * SERIES — the same flow Q passes through both pipes, so head losses ADD:
 *   V_i = Q / A_i,   h_i = f (L/D_i)(V_i²/2g),   h_total = h₁ + h₂.
 *   Resistance is higher than either pipe alone.
 *
 * PARALLEL — both branches share the SAME head loss h (they connect the same
 * two nodes), so the flows ADD. For a given available head h we solve each
 * branch for its flow and sum them:
 *   h = f (L/D_i)(V_i²/2g)  ⇒  V_i = √( 2 g h D_i / (f L) ),  Q_i = A_i V_i,
 *   Q_total = Q₁ + Q₂.
 *   For the same total flow the head loss is LOWER than either pipe alone
 *   (more paths), and the larger-diameter pipe carries more of the flow.
 *
 * Pure functions, SI units, no side effects. Every helper guards against
 * non-physical (≤ 0) input so a mid-drag slider value can never produce
 * NaN/Infinity in the UI.
 */
import { circleArea, majorHeadLoss, velocityHead } from "@/lib/fluidFormulas";
import { GRAVITY } from "@/lib/constants";

/** Clamp to a small positive floor so divisions stay finite. */
const pos = (v: number, min = 1e-9): number =>
  Number.isFinite(v) ? Math.max(v, min) : min;

/** The two arrangements the simulation supports. */
export type Arrangement = "series" | "parallel";

/** Geometry + flow state of a single pipe in the network. */
export interface PipeState {
  /** Diameter D (m). */
  D: number;
  /** Cross-sectional area A = π D²/4 (m²). */
  A: number;
  /** Mean velocity V = Q / A (m/s). */
  V: number;
  /** Volumetric flow rate Q through this pipe (m³/s). */
  Q: number;
  /** Major (friction) head loss h = f(L/D)(V²/2g) (m). */
  h: number;
}

/** Full result of the network computation for the current arrangement. */
export interface NetworkResult {
  arrangement: Arrangement;
  /** Per-pipe state (pipe 1, pipe 2). */
  pipe1: PipeState;
  pipe2: PipeState;
  /** Total head loss across the network (m). */
  hTotal: number;
  /** Total flow through the network (m³/s). */
  qTotal: number;
  /** Pipe 1's share of the total flow, 0..1 (always 1 in series — same Q). */
  share1: number;
  /** Pipe 2's share of the total flow, 0..1. */
  share2: number;
}

/** Build a single pipe's state from a known flow Q (used for series). */
function pipeFromFlow(D: number, L: number, f: number, Q: number): PipeState {
  const A = circleArea(pos(D));
  const V = Math.max(Q, 0) / pos(A);
  const h = majorHeadLoss(f, L, D, V);
  return { D, A, V, Q: Math.max(Q, 0), h };
}

/** Build a single pipe's state from a known head loss h (used for parallel). */
function pipeFromHead(D: number, L: number, f: number, h: number): PipeState {
  const A = circleArea(pos(D));
  // Invert Darcy: h = f(L/D)(V²/2g)  ⇒  V = √( 2 g h D / (f L) ).
  const V = Math.sqrt((2 * GRAVITY * Math.max(h, 0) * pos(D)) / pos(f * L));
  const Q = A * V;
  return { D, A, V, Q, h: Math.max(h, 0) };
}

/**
 * Compute the whole network.
 *
 * The `driver` Q is interpreted per arrangement:
 *  - SERIES   — Q is the TOTAL flow pushed through both pipes (same in each);
 *               head losses add: h_total = h₁ + h₂.
 *  - PARALLEL — Q is the TARGET total flow we want across the parallel pair.
 *               We find the common head h that makes Q₁(h) + Q₂(h) = Q, then
 *               report each branch's flow. Because there are two paths the
 *               head loss is lower than forcing all of Q through one pipe, and
 *               the larger-diameter pipe carries more of the flow.
 *
 * All inputs are clamped to physical (> 0) values.
 */
export function computeNetwork(
  arrangement: Arrangement,
  D1: number,
  D2: number,
  L: number,
  f: number,
  Q: number,
): NetworkResult {
  const d1 = pos(D1);
  const d2 = pos(D2);
  const len = pos(L);
  const fric = pos(f);
  const qDriver = Math.max(Q, 0);

  if (arrangement === "series") {
    // Same flow through both pipes; head losses add.
    const pipe1 = pipeFromFlow(d1, len, fric, qDriver);
    const pipe2 = pipeFromFlow(d2, len, fric, qDriver);
    return {
      arrangement,
      pipe1,
      pipe2,
      hTotal: pipe1.h + pipe2.h,
      qTotal: qDriver,
      share1: 1,
      share2: 1,
    };
  }

  // PARALLEL — find the shared head h that delivers the target total flow.
  // Q_i(h) = A_i √(2 g D_i /(f L)) · √h  =  k_i √h, so Q_total = (k₁+k₂)√h.
  // Hence √h = Q / (k₁ + k₂)  and  h = ( Q / (k₁+k₂) )².
  const k1 = circleArea(d1) * Math.sqrt((2 * GRAVITY * d1) / (fric * len));
  const k2 = circleArea(d2) * Math.sqrt((2 * GRAVITY * d2) / (fric * len));
  const kSum = pos(k1 + k2);
  const sqrtH = qDriver / kSum;
  const h = sqrtH * sqrtH;

  const pipe1 = pipeFromHead(d1, len, fric, h);
  const pipe2 = pipeFromHead(d2, len, fric, h);
  const qTotal = pipe1.Q + pipe2.Q;
  const qt = pos(qTotal);
  return {
    arrangement,
    pipe1,
    pipe2,
    // In parallel the "total head loss" is the common head across the pair.
    hTotal: h,
    qTotal,
    share1: pipe1.Q / qt,
    share2: pipe2.Q / qt,
  };
}

/** Velocity head V²/2g for one pipe (m), re-exported for the UI/formula card. */
export const pipeVelocityHead = (V: number): number => velocityHead(V);

/** A particle advecting along one of the network's pipe segments. */
export interface NetworkParticle {
  /** Normalised position 0→1 along its current segment. */
  xf: number;
  /** Lateral offset across the pipe in [-0.78, 0.78] (share of pipe radius). */
  off: number;
  /** Which pipe this particle belongs to (1 or 2). Series uses 1→2 in turn. */
  pipe: 1 | 2;
}

/**
 * Seed particles. In parallel both pipes carry particles; in series every
 * particle flows pipe 1 then pipe 2, so initial pipe assignment is cosmetic and
 * the sim advances them between segments at runtime.
 */
export function seedParticles(count: number): NetworkParticle[] {
  const out: NetworkParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      off: (Math.random() * 2 - 1) * 0.78,
      pipe: Math.random() < 0.5 ? 1 : 2,
    });
  }
  return out;
}
