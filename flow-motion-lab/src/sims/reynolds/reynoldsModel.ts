/**
 * Model for the Reynolds-number simulation: straight horizontal pipe whose flow
 * transitions laminar → transitional → turbulent as Re grows.
 *
 * The visuals are driven by a single dimensionless "turbulence intensity" that
 * maps Re onto how strongly streamlines wobble, particles jitter and eddies
 * swirl. Pure functions + lightweight particle/eddy state, no side effects.
 */
import { clamp, smoothstep } from "@/lib/math";
import { REYNOLDS_LAMINAR_MAX, REYNOLDS_TURBULENT_MIN } from "@/lib/constants";

/**
 * Turbulence intensity in roughly [0, 1.6].
 *  - 0 below the laminar threshold (smooth, straight flow)
 *  - smoothstep ramp 0→1 across the transitional band (2300 → 4000)
 *  - keeps creeping up slowly past 4000 so very high Re looks more chaotic,
 *    clamped at ~1.6 so the animation never goes unbounded.
 */
export function turbulence(re: number): number {
  if (re <= REYNOLDS_LAMINAR_MAX) return 0;
  const base = smoothstep(REYNOLDS_LAMINAR_MAX, REYNOLDS_TURBULENT_MIN, re);
  if (re <= REYNOLDS_TURBULENT_MIN) return base;
  // Slow logarithmic-ish growth beyond fully turbulent.
  const extra = Math.log10(re / REYNOLDS_TURBULENT_MIN) * 0.6;
  return clamp(base + extra, 0, 1.6);
}

/** A particle flowing left→right along a streamline of the pipe. */
export interface FlowParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Streamline fraction in [-0.85, 0.85] (share of pipe half-height). */
  f: number;
  /** Per-particle random phase so jitter looks uncorrelated. */
  seed: number;
}

/** A small rotating vortex that captures particles passing near its centre. */
export interface Eddy {
  /** Normalised centre position (0→1 horizontal, -1→1 vertical fraction). */
  cx: number;
  cy: number;
  /** Radius as a fraction of pipe half-height. */
  r: number;
  /** Angular speed (rad/s); sign sets rotation direction. */
  omega: number;
  /** Current rotation angle (rad), advanced by dt. */
  angle: number;
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): FlowParticle[] {
  const out: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      f: (Math.random() * 2 - 1) * 0.85,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/** Seed a small fixed set of eddies scattered along the pipe. */
export function seedEddies(count: number): Eddy[] {
  const out: Eddy[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      cx: 0.18 + Math.random() * 0.64,
      cy: (Math.random() * 2 - 1) * 0.45,
      r: 0.18 + Math.random() * 0.22,
      omega: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 1.6),
      angle: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/**
 * Travelling-wave vertical displacement (as a fraction of pipe half-height) for
 * a streamline at horizontal fraction xf. Sums 2–3 harmonics whose amplitude and
 * frequency grow with turbulence `t`; `phase` advances over time (by dt) so the
 * waves travel down the pipe. `lane` decorrelates neighbouring streamlines.
 */
export function streamlineWave(
  xf: number,
  t: number,
  phase: number,
  lane: number,
): number {
  if (t <= 0) return 0;
  const amp = 0.32 * t;
  const k = 4 + 6 * t; // spatial frequency grows with turbulence
  const w1 = Math.sin(k * xf - phase + lane);
  const w2 = 0.5 * Math.sin(2 * k * xf - 1.7 * phase + lane * 1.9);
  const w3 = 0.25 * Math.sin(3.3 * k * xf - 2.4 * phase + lane * 0.7);
  return amp * (w1 + w2 + w3);
}
