/**
 * Physics for the Cavitation & NPSH simulation (Pumps chapter).
 *
 * NPSH (Net Positive Suction Head) compares the head of liquid available at the
 * pump suction above its vapour pressure (NPSH_available) against the head the
 * pump itself needs to avoid cavitation (NPSH_required). When
 * NPSH_available < NPSH_required the local pressure at the impeller eye drops
 * below the liquid's vapour pressure, so the liquid boils into vapour bubbles
 * that violently collapse (cavitate) and erode the impeller.
 *
 *   NPSH_available = (P_atm + P_suction_gauge − P_vapor) / (ρ·g)
 *                    − z_suction − h_loss_suction        [m]
 *
 * SI units throughout (Pa, m, kg/m³). Pressures entering the model are absolute
 * via P_atm + gauge; the lift z and suction losses subtract directly in metres.
 */
import { GRAVITY, P_ATM, RHO_WATER } from "@/lib/constants";
import { clamp } from "@/lib/math";

/**
 * A fixed/illustrative NPSH required for this teaching pump (m).
 * Real pumps publish an NPSH_required curve vs flow; here we use a constant so
 * the learner can focus on how NPSH_available changes with the suction setup.
 */
export const NPSH_REQUIRED = 3; // m

/**
 * Saturation (vapour) pressure of water as a function of temperature.
 *
 * Small lookup table of P_v(T) in kPa (absolute) at representative points;
 * values are interpolated linearly between them. Vapour pressure rises sharply
 * with temperature, so hot water cavitates far more easily than cold water.
 */
const PV_TABLE: { t: number; pv: number }[] = [
  { t: 0, pv: 0.61 },
  { t: 10, pv: 1.23 },
  { t: 20, pv: 2.34 },
  { t: 25, pv: 3.17 },
  { t: 30, pv: 4.25 },
  { t: 40, pv: 7.38 },
  { t: 50, pv: 12.35 },
  { t: 60, pv: 19.95 },
  { t: 70, pv: 31.19 },
  { t: 80, pv: 47.39 },
  { t: 90, pv: 70.14 },
  { t: 95, pv: 84.55 },
  { t: 100, pv: 101.42 },
];

/** Vapour pressure of water at temperature T (°C), returned in kPa absolute. */
export function vaporPressureKPa(tempC: number): number {
  const t = clamp(tempC, PV_TABLE[0].t, PV_TABLE[PV_TABLE.length - 1].t);
  for (let i = 0; i < PV_TABLE.length - 1; i++) {
    const a = PV_TABLE[i];
    const b = PV_TABLE[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      return a.pv + (b.pv - a.pv) * f;
    }
  }
  return PV_TABLE[PV_TABLE.length - 1].pv;
}

/** Inputs to the NPSH calculation. Pressures in kPa, lengths in metres. */
export interface NpshInputs {
  /** Suction gauge pressure at the source/inlet (kPa, can be negative = vacuum). */
  pSuctionKPa: number;
  /** Fluid temperature (°C) — sets the vapour pressure. */
  tempC: number;
  /** Suction lift: height of the pump above the liquid source (m). */
  zSuction: number;
  /** Suction-side head loss from friction & fittings (m). */
  hLoss: number;
}

/** Full NPSH result bundle for the UI and animation. */
export interface NpshResult {
  /** Vapour pressure at the given temperature (kPa absolute). */
  pvKPa: number;
  /** Net positive suction head available (m). */
  npshAvailable: number;
  /** Net positive suction head required (m, fixed/illustrative). */
  npshRequired: number;
  /** Margin = available − required (m, signed). Negative ⇒ cavitation. */
  margin: number;
  /** True when NPSH_available < NPSH_required (cavitation risk). */
  cavitationRisk: boolean;
}

/**
 * NPSH available in metres of liquid column.
 *
 * NPSH_a = (P_atm + P_s − P_v)/(ρg) − z_suction − h_loss
 * Inputs in kPa are converted to Pa; the result is guarded against −∞ but is
 * allowed to go negative so the cavitation regime is visible.
 */
export function npshAvailable(
  inputs: NpshInputs,
  rho: number = RHO_WATER,
  g: number = GRAVITY,
): number {
  const pvKPa = vaporPressureKPa(inputs.tempC);
  const pAbsPa = (P_ATM / 1000 + inputs.pSuctionKPa - pvKPa) * 1000; // → Pa
  const pressureHead = pAbsPa / (rho * g);
  return pressureHead - inputs.zSuction - inputs.hLoss;
}

/** Compute the full NPSH result bundle (margin guarded only for display sanity). */
export function computeNpsh(
  inputs: NpshInputs,
  rho: number = RHO_WATER,
  g: number = GRAVITY,
): NpshResult {
  const pvKPa = vaporPressureKPa(inputs.tempC);
  const npshA = npshAvailable(inputs, rho, g);
  const margin = npshA - NPSH_REQUIRED;
  return {
    pvKPa,
    npshAvailable: npshA,
    npshRequired: NPSH_REQUIRED,
    margin,
    cavitationRisk: margin < 0,
  };
}

/**
 * Cavitation severity in [0,1] from how far below the required head we sit.
 * 0 = safe (margin ≥ 0); approaches 1 as the margin goes strongly negative.
 * Drives bubble count and pop violence in the animation.
 */
export function cavitationSeverity(margin: number): number {
  if (margin >= 0) return 0;
  return clamp(-margin / 4, 0, 1); // ~4 m below required ⇒ fully violent
}
