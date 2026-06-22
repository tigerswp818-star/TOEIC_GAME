/**
 * Pump-curve vs system-curve model (educational, conceptual).
 *
 * Pump curve (affinity-scaled by speed fraction n):  H_p(Q) = n²·H0 − B·Q²
 * System curve:                                       H_s(Q) = h_static + K·Q²
 * Operating point = the intersection (where the pump delivers exactly the head
 * the system demands). Everything is a simplified teaching model, not a real
 * pump selection tool.
 */
import { GRAVITY } from "@/lib/constants";

export interface PumpSysParams {
  /** Pump speed as a fraction of rated (VFD), 0.4–1.1. */
  speed: number;
  /** Static lift the pump must overcome (m). */
  staticHead: number;
  /** Discharge pipe length (m). */
  length: number;
  /** Pipe internal diameter (mm). */
  diameter: number;
  /** Discharge valve opening fraction, 0.1–1. */
  valve: number;
  /** Darcy friction factor (—). */
  friction: number;
}

export const RATED = {
  H0: 55, // rated shut-off head (m) at n = 1
  Qmax: 0.09, // approx rated max flow (m³/s) where H ≈ 0
  Qbep: 0.055, // rated best-efficiency flow (m³/s)
  etaMax: 0.82, // peak efficiency
  bepWidth: 0.055, // efficiency parabola half-width
};
/** Pump quadratic coefficient so H0 − B·Qmax² ≈ 0. */
const B = RATED.H0 / (RATED.Qmax * RATED.Qmax);
const RHO = 1000;

/** Pump head at flow Q (m³/s) and speed fraction n. */
export function pumpHead(Q: number, n: number): number {
  return n * n * RATED.H0 - B * Q * Q;
}

/** System resistance coefficient K from pipe + valve (h = h_static + K·Q²). */
export function systemK(p: PumpSysParams): number {
  const D = p.diameter / 1000; // mm → m
  const g = GRAVITY;
  // Darcy friction expressed in Q: K_f = 8 f L / (π² g D⁵)
  const Kf = (8 * p.friction * p.length) / (Math.PI * Math.PI * g * Math.pow(D, 5));
  // Valve as a minor loss that grows sharply as it closes.
  const Kv = 0.25 * (1 / (p.valve * p.valve) - 1) + 0.2;
  const Kvalve = (8 * Kv) / (Math.PI * Math.PI * g * Math.pow(D, 4));
  return Kf + Kvalve;
}

/** System head demanded at flow Q. */
export function systemHead(Q: number, p: PumpSysParams): number {
  return p.staticHead + systemK(p) * Q * Q;
}

/** Pump efficiency at flow Q for speed n (BEP scales with speed). */
export function pumpEfficiency(Q: number, n: number): number {
  const qbep = RATED.Qbep * n;
  const w = RATED.bepWidth * n || 1e-6;
  const e = RATED.etaMax * (1 - Math.pow((Q - qbep) / w, 2));
  return Math.max(0.08, e);
}

export interface PumpSysResult {
  Qop: number; // m³/s
  Hop: number; // m
  eta: number; // 0..1
  shaftPowerW: number;
  hydraulicPowerW: number;
  Qbep: number; // m³/s at this speed
  bepDistPct: number; // signed % from BEP
  shutoff: boolean; // pump can't overcome static head
  K: number;
}

/** Solve the operating point (pump curve ∩ system curve). */
export function solveOperating(p: PumpSysParams): PumpSysResult {
  const K = systemK(p);
  const num = p.speed * p.speed * RATED.H0 - p.staticHead;
  const Qop = num > 0 ? Math.sqrt(num / (B + K)) : 0;
  const Hop = systemHead(Qop, p);
  const eta = pumpEfficiency(Qop, p.speed);
  const hydraulicPowerW = RHO * GRAVITY * Qop * Hop;
  const shaftPowerW = hydraulicPowerW / eta;
  const Qbep = RATED.Qbep * p.speed;
  const bepDistPct = Qbep > 0 ? ((Qop - Qbep) / Qbep) * 100 : 0;
  return {
    Qop,
    Hop,
    eta,
    shaftPowerW,
    hydraulicPowerW,
    Qbep,
    bepDistPct,
    shutoff: num <= 0,
    K,
  };
}

/** Build polyline points for the pump curve at speed n (Q in m³/s). */
export function pumpCurvePoints(n: number, qMax: number, steps = 40): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const Q = (i / steps) * qMax;
    const H = pumpHead(Q, n);
    if (H < 0) break;
    out.push({ x: Q, y: H });
  }
  return out;
}

/** Build polyline points for the system curve. */
export function systemCurvePoints(p: PumpSysParams, qMax: number, steps = 40): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const Q = (i / steps) * qMax;
    out.push({ x: Q, y: systemHead(Q, p) });
  }
  return out;
}
