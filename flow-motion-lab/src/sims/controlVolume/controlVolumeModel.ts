/**
 * Mass-balance model for the Control Volume simulation.
 *
 * A tank (the control volume) receives two inflows and loses one outflow. For an
 * incompressible fluid the net rate of accumulation of volume inside the control
 * volume is simply the difference between what comes in and what goes out:
 *
 *     dV/dt = ΣQin − Qout = (Qin1 + Qin2) − Qout      [m³/s]
 *
 * Multiplying by density gives the net mass rate (conservation of mass):
 *
 *     ṁ_net = ρ · dV/dt                                [kg/s]
 *
 * The water *level* in a tank of constant cross-section area A_tank then changes
 * at  dh/dt = (dV/dt) / A_tank  [m/s], which we integrate over time below.
 */
import { clamp } from "@/lib/math";
import { RHO_WATER } from "@/lib/constants";

/** The three discrete states of the control volume. */
export type BalanceState = "rising" | "steady" | "falling";

/** A computed snapshot of the mass balance for given flow rates. */
export interface MassBalance {
  /** Total inflow ΣQin = Qin1 + Qin2 (m³/s). */
  inflow: number;
  /** Outflow Qout (m³/s). */
  outflow: number;
  /** Net accumulation rate dV/dt = ΣQin − Qout (m³/s, signed). */
  net: number;
  /** Net mass rate ṁ = ρ · dV/dt (kg/s, signed). */
  massRate: number;
  /** Qualitative state of the control volume. */
  state: BalanceState;
}

/** Below this |net| (m³/s) the tank is treated as effectively steady. */
export const STEADY_EPS = 0.005;

/**
 * Compute the mass balance for a control volume with two inflows and one
 * outflow. All flow rates are clamped to be non-negative (a pipe cannot supply
 * a negative volume rate).
 */
export function massBalance(
  qin1: number,
  qin2: number,
  qout: number,
  rho: number = RHO_WATER,
): MassBalance {
  const inflow = Math.max(0, qin1) + Math.max(0, qin2);
  const outflow = Math.max(0, qout);
  const net = inflow - outflow;
  const massRate = rho * net;
  const state: BalanceState =
    net > STEADY_EPS ? "rising" : net < -STEADY_EPS ? "falling" : "steady";
  return { inflow, outflow, net, massRate, state };
}

/** Thai label for a balance state (used by the right-rail ResultStat). */
export function stateLabel(state: BalanceState): string {
  switch (state) {
    case "rising":
      return "กำลังเพิ่ม";
    case "falling":
      return "กำลังลด";
    default:
      return "คงที่";
  }
}

/**
 * Integrate the tank water level by one time step.
 *
 *     level += (net / A_tank) · dt
 *
 * `level` and the returned value are a normalised fill fraction in [0, 1]
 * (0 = empty tank, 1 = full / overflowing). `net` is dV/dt (m³/s), `aTank` the
 * cross-section area (m²) and `dt` the (speed-scaled) time step in seconds.
 *
 * `fullVolume` is the volume (m³) represented by a completely full tank — it
 * converts the volumetric rate into a fraction-per-second so the animation runs
 * at a sensible visual pace regardless of A_tank.
 */
export function integrateLevel(
  level: number,
  net: number,
  aTank: number,
  dt: number,
  fullVolume: number,
): number {
  if (dt <= 0 || fullVolume <= 0) return clamp(level, 0, 1);
  // dh/dt = (net / A_tank); convert the height change to a fill fraction by
  // dividing by the tank height implied by fullVolume = A_tank · height.
  const height = fullVolume / Math.max(aTank, 1e-6);
  const dLevel = (net / Math.max(aTank, 1e-6) / Math.max(height, 1e-6)) * dt;
  return clamp(level + dLevel, 0, 1);
}

/** A single streaming particle for the in/out pipes (normalised progress). */
export interface StreamParticle {
  /** Progress 0→1 along the pipe path. */
  t: number;
  /** Lateral jitter fraction in [-1, 1] across the pipe width. */
  j: number;
}

/** Seed `count` particles with random progress + jitter along a pipe. */
export function seedStream(count: number): StreamParticle[] {
  const out: StreamParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ t: Math.random(), j: Math.random() * 2 - 1 });
  }
  return out;
}
