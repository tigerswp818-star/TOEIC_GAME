/**
 * Water hammer (hydraulic transient) model — educational.
 *
 *   Critical (pipe) time:  Tc = 2L / a
 *   Joukowsky (rapid, t ≤ Tc):  ΔP = ρ·a·ΔV ,  ΔH = a·ΔV/g
 *   Slow closure (t > Tc): surge reduced ≈ × (Tc / t)   (Michaud/Allievi)
 *
 * Simplified teaching model. Real transient analysis needs method-of-
 * characteristics / surge software and a qualified engineer.
 */
import { GRAVITY } from "@/lib/constants";

export interface WHParams {
  velocity: number; // m/s (steady flow before closure)
  closeTime: number; // s (valve closing time)
  length: number; // m (pipe length)
  waveSpeed: number; // m/s (pressure wave celerity)
  density: number; // kg/m³
}

export type WHRisk = "low" | "medium" | "high";

export interface WHResult {
  criticalTime: number; // Tc = 2L/a
  factor: number; // surge reduction factor (≤1)
  surgePa: number;
  surgeBar: number;
  headRise: number; // m
  rapid: boolean; // closing faster than critical time
  risk: WHRisk;
}

export function computeWaterHammer(p: WHParams): WHResult {
  const criticalTime = (2 * p.length) / p.waveSpeed;
  const rapid = p.closeTime <= criticalTime;
  const factor = rapid ? 1 : criticalTime / p.closeTime;
  const surgePa = p.density * p.waveSpeed * p.velocity * factor;
  const headRise = (p.waveSpeed * p.velocity * factor) / GRAVITY;
  const surgeBar = surgePa / 1e5;
  const risk: WHRisk = surgeBar > 10 ? "high" : surgeBar > 4 ? "medium" : "low";
  return { criticalTime, factor, surgePa, surgeBar, headRise, rapid, risk };
}
