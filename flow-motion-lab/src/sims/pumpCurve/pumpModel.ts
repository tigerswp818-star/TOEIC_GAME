/**
 * Physics + geometry model for the Pump Curve & System Curve simulation.
 *
 * Two head–flow (Q vs H) characteristics meet at the operating point:
 *   • Pump curve:   H_pump(Q) = H0 − a·Q²            (falls as flow rises)
 *   • System curve: H_sys(Q)  = H_static + C·Q²       (rises with flow)
 *
 * Pump head scales with speed N (affinity law H0 ∝ N²); a is treated as a
 * constant for a given impeller. System resistance C grows as the valve closes.
 * All formulas guard against negatives and divide-by-zero so a mid-drag slider
 * value can never produce NaN/Infinity.
 */
import { GRAVITY, RHO_WATER } from "@/lib/constants";

/** Reference (rated) pump speed used by the affinity law, in % of rated. */
export const N_REF = 100;
/** Shut-off head at the reference speed, H0_ref (m) — pump head at Q = 0. */
export const H0_REF = 50;
/** Pump curve steepness coefficient a (constant for the impeller), s²/m⁵. */
export const PUMP_A = 80;
/** Baseline system resistance C at a fully-open valve, s²/m⁵. */
export const C_BASE = 30;

/** Pump shut-off head H0 at speed N (% of rated): H0 = H0_ref·(N/N_ref)². */
export function pumpShutoffHead(n: number): number {
  const ratio = Math.max(n, 0) / N_REF;
  return H0_REF * ratio * ratio;
}

/** Pump head at a given flow: H_pump(Q) = H0 − a·Q² (clamped ≥ 0). */
export function pumpHead(q: number, n: number): number {
  return Math.max(pumpShutoffHead(n) - PUMP_A * q * q, 0);
}

/**
 * System resistance C from valve opening (% open). Closing the valve raises
 * resistance: C = C_base·(100/valve)². Valve clamped to a small minimum so a
 * nearly-shut valve stays finite.
 */
export function systemResistance(valve: number): number {
  const open = Math.max(valve, 1);
  const factor = 100 / open;
  return C_BASE * factor * factor;
}

/** System head at a given flow: H_sys(Q) = H_static + C·Q². */
export function systemHead(q: number, hStatic: number, valve: number): number {
  return Math.max(hStatic, 0) + systemResistance(valve) * q * q;
}

export interface OperatingPoint {
  /** Flow rate at the operating point, m³/s. */
  qOp: number;
  /** Head at the operating point, m. */
  hOp: number;
  /** Hydraulic power P = ρ·g·Q·H, W. */
  power: number;
  /** Pump shut-off head H0 at this speed, m. */
  h0: number;
  /** System resistance coefficient C, s²/m⁵. */
  c: number;
  /** True when the pump cannot overcome the static head (Q_op = 0). */
  deadHead: boolean;
}

/**
 * Solve the operating point (intersection of pump & system curves):
 *   H0 − a·Q² = H_static + C·Q²
 *   → Q_op = sqrt( max(H0 − H_static, 0) / (a + C) )
 *   → H_op = H_static + C·Q_op²
 * If H0 ≤ H_static the pump can't overcome the static head → Q_op = 0.
 */
export function operatingPoint(
  n: number,
  hStatic: number,
  valve: number,
): OperatingPoint {
  const h0 = pumpShutoffHead(n);
  const c = systemResistance(valve);
  const staticHead = Math.max(hStatic, 0);
  const numerator = Math.max(h0 - staticHead, 0);
  const denom = Math.max(PUMP_A + c, 1e-9);
  const qOp = Math.sqrt(numerator / denom);
  const hOp = staticHead + c * qOp * qOp;
  const power = RHO_WATER * GRAVITY * qOp * hOp;
  return { qOp, hOp, power, h0, c, deadHead: qOp <= 1e-9 };
}

/**
 * Sample the pump & system curves over [0, qMax] for the Q–H chart.
 * Returns matched arrays of {x: Q, y: H} points.
 */
export function sampleCurves(
  n: number,
  hStatic: number,
  valve: number,
  qMax: number,
  steps = 48,
): { pump: { x: number; y: number }[]; system: { x: number; y: number }[] } {
  const span = Math.max(qMax, 1e-6);
  const pump: { x: number; y: number }[] = [];
  const system: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = (i / steps) * span;
    pump.push({ x: q, y: pumpHead(q, n) });
    system.push({ x: q, y: systemHead(q, hStatic, valve) });
  }
  return { pump, system };
}

/**
 * A sensible upper bound for the Q axis: the free-delivery flow of the pump at
 * the reference speed (where H_pump = 0, ignoring the system), padded a little
 * so the operating point sits comfortably inside the chart.
 */
export function maxFlow(): number {
  return Math.sqrt(H0_REF / Math.max(PUMP_A, 1e-9)) * 1.05;
}

export interface PumpParticle {
  /** Normalised horizontal position 0→1 along the pipe. */
  xf: number;
  /** Streamline fraction in [-0.8, 0.8] (share of pipe half-height). */
  f: number;
}

/** Seed a fresh set of particles spread along the pipe. */
export function seedParticles(count: number): PumpParticle[] {
  const out: PumpParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.8 });
  }
  return out;
}

/** Normalised x positions of the pump body and the valve glyph on the pipe. */
export const PUMP_XF = 0.16;
export const VALVE_XF = 0.66;
