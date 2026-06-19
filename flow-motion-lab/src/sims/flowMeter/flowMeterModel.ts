/**
 * Physics + geometry model for the Flow Meter Comparison simulation
 * (Chapter: CFD & Experimental).
 *
 * Three differential-pressure flow meters are compared. Each derives the flow
 * from a measured pressure difference ΔP, but with very different permanent
 * energy losses and discharge coefficients:
 *
 *   • Pitot tube      — measures stagnation − static pressure at a point and
 *                       gives a LOCAL velocity:  V = √(2·ΔP / ρ).
 *   • Venturi meter   — smooth contraction/expansion, taps up- & at-throat:
 *                       Q = Cd·A₂·√( 2·ΔP / (ρ·(1 − (A₂/A₁)²)) ),  Cd ≈ 0.98.
 *   • Orifice meter   — a sharp-edged plate, taps either side. Same equation as
 *                       the Venturi but the jet separates (vena contracta) so the
 *                       discharge coefficient is much lower, Cd ≈ 0.62, and the
 *                       permanent pressure loss is large.
 *
 * Pure functions, SI units, no side effects. Each guards against non-physical
 * input (β → 1 giving 1 − β⁴ → 0, ρ ≤ 0, etc.) so a mid-drag slider can never
 * produce NaN / Infinity in the UI.
 */
import { circleArea, flowRate } from "@/lib/fluidFormulas";
import { lerp, smoothstep } from "@/lib/math";

const safe = (v: number, min = 1e-9): number =>
  Number.isFinite(v) ? Math.max(v, min) : min;

/** The three meter devices the learner can compare. */
export type DeviceKind = "pitot" | "venturi" | "orifice";

export const DEVICES: DeviceKind[] = ["pitot", "venturi", "orifice"];

export interface DeviceInfo {
  kind: DeviceKind;
  /** Thai + English short label for the toggle chip. */
  label: string;
  icon: string;
  /** Discharge coefficient Cd (Pitot has none → null). */
  cd: number | null;
  /** Thai display name. */
  nameTh: string;
  /** Permanent (unrecoverable) pressure-loss fraction of ΔP — for the bar chart. */
  lossFraction: number;
}

/** Discharge coefficients — the Venturi/Orifice gap is the key teaching point. */
export const CD_VENTURI = 0.98;
export const CD_ORIFICE = 0.62;

/**
 * Permanent head-loss fractions (share of the measured ΔP that is lost forever).
 * A Pitot tube barely disturbs the flow; a Venturi recovers most of its pressure;
 * a sharp orifice loses the most. These are representative teaching values.
 */
export const LOSS_PITOT = 0.05;
export const LOSS_VENTURI = 0.15;
export const LOSS_ORIFICE = 0.75;

export const DEVICE_INFO: Record<DeviceKind, DeviceInfo> = {
  pitot: {
    kind: "pitot",
    label: "พิโตต์ Pitot",
    icon: "🪡",
    cd: null,
    nameTh: "หลอดพิโตต์",
    lossFraction: LOSS_PITOT,
  },
  venturi: {
    kind: "venturi",
    label: "เวนทูรี Venturi",
    icon: "⏳",
    cd: CD_VENTURI,
    nameTh: "เวนทูรีมิเตอร์",
    lossFraction: LOSS_VENTURI,
  },
  orifice: {
    kind: "orifice",
    label: "ออริฟิซ Orifice",
    icon: "🟰",
    cd: CD_ORIFICE,
    nameTh: "ออริฟิซมิเตอร์",
    lossFraction: LOSS_ORIFICE,
  },
};

/** Map a guided/preset numeric sentinel → device kind. */
export const DEVICE_BY_INDEX: DeviceKind[] = ["pitot", "venturi", "orifice"];

/** Pipe (upstream) cross-sectional area A₁ from diameter D₁ (m²). */
export const pipeArea = (d1: number): number => circleArea(d1);

/** Throat / orifice cross-sectional area A₂ = β²·A₁ (m²). */
export const throatArea = (a1: number, beta: number): number => beta * beta * a1;

/**
 * The ΔP a meter would read for a true mean velocity V in the pipe (Pa).
 *
 * Pitot: ΔP = ½·ρ·V²  (stagnation − static at a point in the stream).
 * Venturi/Orifice: from the meter equation, Q = A₁·V, so
 *   ΔP = ρ·(1 − β⁴)·V² / (2·Cd²)   where V₂ = V/β².
 * The 1 − β⁴ term is guarded so β → 1 never divides by zero.
 */
export function deltaPForVelocity(
  device: DeviceKind,
  v: number,
  rho: number,
  beta: number,
): number {
  const r = safe(rho);
  if (device === "pitot") return 0.5 * r * v * v;
  const cd = device === "venturi" ? CD_VENTURI : CD_ORIFICE;
  const oneMinusBeta4 = safe(1 - beta ** 4, 1e-6);
  return (r * oneMinusBeta4 * v * v) / (2 * cd * cd);
}

/**
 * Back-computed LOCAL velocity a Pitot tube reports from its ΔP (m/s):
 *   V = √(2·ΔP / ρ).
 */
export function pitotVelocity(dp: number, rho: number): number {
  return Math.sqrt((2 * Math.max(dp, 0)) / safe(rho));
}

/**
 * Back-computed volumetric flow rate Q from a Venturi/Orifice ΔP (m³/s):
 *   Q = Cd·A₂·√( 2·ΔP / (ρ·(1 − (A₂/A₁)²)) ).
 * A₂/A₁ = β², so 1 − (A₂/A₁)² = 1 − β⁴ (guarded).
 */
export function meterFlowRate(
  device: DeviceKind,
  dp: number,
  rho: number,
  a1: number,
  beta: number,
): number {
  const cd = device === "venturi" ? CD_VENTURI : CD_ORIFICE;
  const a2 = throatArea(a1, beta);
  const oneMinusBeta4 = safe(1 - beta ** 4, 1e-6);
  return cd * a2 * Math.sqrt((2 * Math.max(dp, 0)) / (safe(rho) * oneMinusBeta4));
}

export interface MeterResult {
  /** Active device. */
  device: DeviceKind;
  /** ΔP the device reads for the current true velocity (Pa). */
  dp: number;
  /** Measured flow rate Q (m³/s). For Pitot, derived from its local V × A₁. */
  q: number;
  /** Measured velocity (m/s). For Pitot this is the local V it reports. */
  vMeasured: number;
  /** Discharge coefficient (null for Pitot). */
  cd: number | null;
  /** Upstream pipe area A₁ (m²). */
  a1: number;
  /** Throat / orifice area A₂ (m²). */
  a2: number;
  /** Permanent pressure loss for this device (Pa). */
  loss: number;
}

/**
 * Full forward → inverse computation: given a true mean velocity V, work out the
 * ΔP each device reads, then back-compute the measured V/Q to show the method.
 */
export function computeMeter(
  device: DeviceKind,
  v: number,
  d1: number,
  beta: number,
  rho: number,
): MeterResult {
  const a1 = pipeArea(d1);
  const a2 = throatArea(a1, beta);
  const dp = deltaPForVelocity(device, v, rho, beta);
  const info = DEVICE_INFO[device];

  let vMeasured: number;
  let q: number;
  if (device === "pitot") {
    vMeasured = pitotVelocity(dp, rho);
    q = flowRate(a1, vMeasured);
  } else {
    q = meterFlowRate(device, dp, rho, a1, beta);
    vMeasured = q / safe(a1);
  }

  return {
    device,
    dp,
    q,
    vMeasured,
    cd: info.cd,
    a1,
    a2,
    loss: dp * info.lossFraction,
  };
}

/* ────────────────────────────── canvas geometry ────────────────────────────── */

export interface MeterParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Streamline fraction in [-0.92, 0.92] (share of local half-height). */
  f: number;
  /** Random phase used for turbulent jitter downstream of the orifice plate. */
  seed: number;
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): MeterParticle[] {
  const out: MeterParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      f: (Math.random() * 2 - 1) * 0.92,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/** Tap / probe positions (normalised x) for the schematic & manometer columns. */
export const TAP_UP = 0.28;
export const TAP_DOWN = 0.6;
/** Where the throat / orifice plate / Pitot probe sits along the pipe. */
export const STATION = 0.5;

/** Profile control points (fractions of width) for a venturi contraction. */
const T1 = 0.34;
const T2 = 0.46;
const T3 = 0.54;
const T4 = 0.66;

/**
 * Local cross-sectional area at normalised position xf for the ACTIVE device,
 * as a fraction of the pipe area A₁ (so the drawing scale stays consistent).
 *
 * • pitot   — straight pipe (no contraction), the probe is drawn separately.
 * • venturi — smooth contraction to β² then smooth expansion (low loss).
 * • orifice — full-bore pipe with a sudden hole; the effective flow area drops
 *   to the vena contracta (≈ β² · 0.62) just behind the plate, then slowly
 *   recovers — modelling the separated, lossy jet.
 */
export function areaFracAt(xf: number, device: DeviceKind, beta: number): number {
  const throat = beta * beta;
  if (device === "pitot") return 1;
  if (device === "venturi") {
    if (xf < T1) return 1;
    if (xf < T2) return lerp(1, throat, smoothstep(T1, T2, xf));
    if (xf < T3) return throat;
    if (xf < T4) return lerp(throat, 1, smoothstep(T3, T4, xf));
    return 1;
  }
  // orifice: sudden contraction at the plate, slow turbulent recovery.
  const vena = throat * 0.62;
  if (xf < STATION) return 1;
  if (xf < STATION + 0.02) return vena;
  if (xf < 0.9) return lerp(vena, 1, smoothstep(STATION + 0.02, 0.9, xf));
  return 1;
}

/** Local velocity from continuity along the schematic: V(x) = V·A₁ / A(x). */
export function velocityFracAt(xf: number, device: DeviceKind, beta: number): number {
  return 1 / Math.max(areaFracAt(xf, device, beta), 1e-6);
}

/** True (mid-stream) speed multiplier at the measuring station, for colour scaling. */
export function maxVelocityFrac(device: DeviceKind, beta: number): number {
  return velocityFracAt(STATION, device, beta);
}
