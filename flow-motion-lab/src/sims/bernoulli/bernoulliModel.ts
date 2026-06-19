/**
 * Geometry + particle model for the Bernoulli / Venturi simulation.
 * A horizontal Venturi channel (wide inlet → narrow throat → wide outlet) whose
 * local cross-sectional area is animated. Particle speed follows continuity
 * V(x) = V₁·A₁ / A(x), so the throat visibly accelerates the flow; the static
 * pressure then falls there per Bernoulli's principle.
 *
 * Shares the same smoothstep area profile idea as the Continuity model so the
 * two simulations read as the same family of pipes.
 */
import { lerp, smoothstep } from "@/lib/math";

export interface PipeParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Streamline fraction in [-0.92, 0.92] (share of local half-height). */
  f: number;
}

/** Profile control points (fractions of width) for wide→throat→wide. */
const T1 = 0.3;
const T2 = 0.44;
const T3 = 0.56;
const T4 = 0.7;

/** Cross-sectional area at normalised position xf, given inlet/throat areas. */
export function areaAt(xf: number, a1: number, a2: number): number {
  if (xf < T1) return a1;
  if (xf < T2) return lerp(a1, a2, smoothstep(T1, T2, xf));
  if (xf < T3) return a2;
  if (xf < T4) return lerp(a2, a1, smoothstep(T3, T4, xf));
  return a1;
}

/** Local velocity from continuity: V(x) = V₁·A₁ / A(x). */
export function velocityAt(xf: number, a1: number, a2: number, v1: number): number {
  return (v1 * a1) / Math.max(areaAt(xf, a1, a2), 1e-6);
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): PipeParticle[] {
  const out: PipeParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.92 });
  }
  return out;
}

/** Inlet, throat & outlet manometer / measurement positions (normalised). */
export const PLANE_INLET = 0.16;
export const PLANE_THROAT = 0.5;
export const PLANE_OUTLET = 0.84;

/**
 * Inlet static gauge pressure used as a fixed reference (Pa). The horizontal
 * pipe means elevation is constant along it, so the whole pressure profile is
 * pinned to this value at the wide inlet and varies only with velocity.
 */
export const P_REF = 25000;

/**
 * Local static (gauge) pressure along the pipe from Bernoulli, measured against
 * the inlet reference: P(x) = P₁ + ½ρ(V₁² − V(x)²)  (Pa).
 * Falls in the throat where the velocity is highest.
 */
export function pressureAt(
  xf: number,
  a1: number,
  a2: number,
  v1: number,
  rho: number,
): number {
  const v = velocityAt(xf, a1, a2, v1);
  return P_REF + 0.5 * rho * (v1 * v1 - v * v);
}
