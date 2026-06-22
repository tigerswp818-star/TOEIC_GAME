/**
 * Cavitation / NPSH model (educational).
 *
 *   NPSHa = (P_atm − P_vapor)/(ρg) − z_lift − h_loss     [open sump]
 *   margin = NPSHa − NPSHr
 * Cavitation occurs when NPSHa falls below NPSHr (margin < 0): the local
 * pressure at the impeller eye drops to the vapour pressure, vapour bubbles
 * form and then collapse violently — damaging the impeller. Simplified teaching
 * model, not a pump-selection tool.
 */
import { GRAVITY } from "@/lib/constants";

const P_ATM = 101325; // Pa
const RHO = 1000; // kg/m³

/** Saturation vapour pressure of water (Pa) from temperature (°C), Antoine eq. */
export function vaporPressurePa(tempC: number): number {
  const A = 8.07131;
  const B = 1730.63;
  const C = 233.426;
  const mmHg = Math.pow(10, A - B / (C + tempC));
  return mmHg * 133.322;
}

export interface CavParams {
  tempC: number;
  /** Static suction lift — pump above water level (m). */
  lift: number;
  /** Suction pipe friction/fitting loss (m). */
  loss: number;
  /** Required NPSH of the pump (m). */
  npshr: number;
}

export type CavRisk = "safe" | "warning" | "danger";

export interface CavResult {
  npsha: number;
  margin: number;
  pvKpa: number;
  risk: CavRisk;
  /** 0 (none) → 1 (severe) cavitation intensity for the animation. */
  severity: number;
}

export function computeCavitation(p: CavParams): CavResult {
  const pv = vaporPressurePa(p.tempC);
  const npsha = (P_ATM - pv) / (RHO * GRAVITY) - p.lift - p.loss;
  const margin = npsha - p.npshr;
  const risk: CavRisk = margin > 1 ? "safe" : margin >= 0 ? "warning" : "danger";
  const severity =
    margin >= 1 ? 0 : margin >= 0 ? (1 - margin) * 0.35 : Math.min(1, 0.35 + -margin * 0.3);
  return { npsha, margin, pvKpa: pv / 1000, risk, severity };
}
