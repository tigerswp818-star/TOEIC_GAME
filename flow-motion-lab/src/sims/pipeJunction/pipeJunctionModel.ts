/**
 * Physics + geometry model for the Pipe Junction (mass balance) simulation.
 *
 * A branching pipe carries an incompressible fluid: one inlet splits into two
 * outlets. Conservation of mass for an incompressible, steady flow reduces to a
 * volumetric-flow balance at the junction:
 *
 *   Q_in = Q_out1 + Q_out2          (Σṁ_in = Σṁ_out)
 *
 * Two operating modes:
 *  - "auto"   — the learner sets Q_in and Q_out1; Q_out2 is computed so the
 *               junction is always balanced: Q_out2 = max(0, Q_in − Q_out1).
 *  - "manual" — the learner sets all three flows independently; the model
 *               reports the imbalance Σout − Q_in so the UI can warn when mass
 *               is not conserved.
 */

/** Junction operating modes. */
export type JunctionMode = "auto" | "manual";

/** Result of the mass balance at the junction. */
export interface JunctionBalance {
  /** Inlet volumetric flow rate (m³/s). */
  qIn: number;
  /** Outlet 1 volumetric flow rate (m³/s). */
  qOut1: number;
  /** Outlet 2 volumetric flow rate (m³/s). In "auto" mode this is computed. */
  qOut2: number;
  /** Sum of the two outlet flows (m³/s). */
  qOutSum: number;
  /** Signed imbalance Σout − Q_in (m³/s): 0 balanced, >0 over, <0 under. */
  imbalance: number;
  /** True when |imbalance| is below the significance threshold. */
  balanced: boolean;
}

/** Imbalance below this magnitude (m³/s) is treated as "balanced". */
export const IMBALANCE_EPS = 0.005;

/**
 * Compute the junction mass balance for the given mode.
 *
 * Inputs are clamped to non-negative physical flows so a mid-drag slider can
 * never yield a negative outlet flow or NaN.
 *
 * In "auto" mode the second outlet is derived to keep mass conserved:
 *   Q_out2 = max(0, Q_in − Q_out1)
 * so the returned imbalance is ≈0 (it can be >0 only if Q_out1 > Q_in, where
 * the clamped Q_out2 = 0 cannot absorb the surplus — the UI then warns).
 */
export function junctionBalance(
  mode: JunctionMode,
  qIn: number,
  qOut1: number,
  qOut2: number,
): JunctionBalance {
  const inFlow = Math.max(qIn, 0);
  const out1 = Math.max(qOut1, 0);
  const out2 = mode === "auto" ? Math.max(0, inFlow - out1) : Math.max(qOut2, 0);
  const qOutSum = out1 + out2;
  const imbalance = qOutSum - inFlow;
  return {
    qIn: inFlow,
    qOut1: out1,
    qOut2: out2,
    qOutSum,
    imbalance,
    balanced: Math.abs(imbalance) <= IMBALANCE_EPS,
  };
}

/**
 * Classify the imbalance into a regime the UI can react to:
 *  - "balanced" — outflow matches inflow (mass conserved)
 *  - "piling"   — outflow < inflow, fluid accumulates at the junction
 *  - "starving" — outflow > inflow, outlets demand more than is supplied
 */
export type ImbalanceRegime = "balanced" | "piling" | "starving";

export function imbalanceRegime(b: JunctionBalance): ImbalanceRegime {
  if (b.balanced) return "balanced";
  return b.imbalance < 0 ? "piling" : "starving";
}

/** A particle advecting along one branch of the junction. */
export interface JunctionParticle {
  /** Normalised arc position 0→1 along its current branch. */
  s: number;
  /** Which branch the particle is on. */
  branch: Branch;
  /** Lateral offset across the pipe in [-0.8, 0.8] (share of pipe radius). */
  off: number;
  /** Whether this particle is currently "piled up" at the junction. */
  piled: boolean;
}

/** The three branches of the Y/T junction. */
export type Branch = "in" | "out1" | "out2";

/** Seed a set of particles, mostly on the inlet so the flow looks like it feeds the split. */
export function seedParticles(count: number): JunctionParticle[] {
  const out: JunctionParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      s: Math.random(),
      branch: "in",
      off: (Math.random() * 2 - 1) * 0.8,
      piled: false,
    });
  }
  return out;
}

/** A point on a branch centreline plus the local pipe normal (in pixels). */
export interface BranchPoint {
  x: number;
  y: number;
  /** Unit normal perpendicular to the branch direction. */
  nx: number;
  ny: number;
}

/** Geometry of the junction in canvas pixels: the meeting point and three tips. */
export interface JunctionGeometry {
  /** Junction (split) point. */
  jx: number;
  jy: number;
  /** Inlet branch start (left edge). */
  inX: number;
  inY: number;
  /** Outlet 1 tip (upper-right). */
  o1X: number;
  o1Y: number;
  /** Outlet 2 tip (lower-right). */
  o2X: number;
  o2Y: number;
}

/** Build the Y-junction geometry from the canvas size. */
export function junctionGeometry(width: number, height: number): JunctionGeometry {
  const cy = height / 2;
  const spread = height * 0.26;
  return {
    jx: width * 0.46,
    jy: cy,
    inX: width * 0.04,
    inY: cy,
    o1X: width * 0.96,
    o1Y: cy - spread,
    o2X: width * 0.96,
    o2Y: cy + spread,
  };
}

/**
 * A point along a branch at arc-fraction s ∈ [0,1] (inlet: edge→junction;
 * outlets: junction→tip), plus the unit normal for lateral particle offset.
 */
export function branchPoint(
  branch: Branch,
  s: number,
  g: JunctionGeometry,
): BranchPoint {
  const t = Math.min(Math.max(s, 0), 1);
  let ax: number;
  let ay: number;
  let bx: number;
  let by: number;
  if (branch === "in") {
    ax = g.inX;
    ay = g.inY;
    bx = g.jx;
    by = g.jy;
  } else if (branch === "out1") {
    ax = g.jx;
    ay = g.jy;
    bx = g.o1X;
    by = g.o1Y;
  } else {
    ax = g.jx;
    ay = g.jy;
    bx = g.o2X;
    by = g.o2Y;
  }
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: ax + dx * t,
    y: ay + dy * t,
    nx: -dy / len,
    ny: dx / len,
  };
}
