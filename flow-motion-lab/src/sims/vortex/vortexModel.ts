/**
 * Model for the Vortex simulation: a top-down view of a rotating circular tank.
 *
 * Uses a **Rankine vortex** — physically real and the key to the brief's
 * "ความเร็วใกล้ศูนย์กลางมากกว่าด้านนอก": a solid-body (forced) core that spins
 * together, surrounded by a free-vortex region whose speed falls off as 1/r.
 *
 *   vθ(r) = ω·r              for r ≤ r_core   (solid-body / forced core)
 *   vθ(r) = ω·r_core²/r      for r > r_core    (free vortex outside)
 *
 * So vθ rises linearly from the centre to a peak at r_core, then decays
 * outward — high near the centre, lower far out. Pure functions + lightweight
 * particle state, no side effects.
 */
import { clamp } from "@/lib/math";

/** How strongly viscosity damps the effective angular speed (effΩ = ω/(1+k·μ)). */
export const VISCOSITY_DAMP_K = 0.9;
/** How much viscosity enlarges the core (more solid-body-like, smoother). */
export const VISCOSITY_CORE_K = 0.5;

/**
 * Tangential speed of a Rankine vortex at radius r (m), given angular speed
 * ω (rad/s) and core radius r_core (m). Returns vθ in m/s.
 */
export function tangentialSpeed(r: number, omega: number, rCore: number): number {
  const rc = Math.max(rCore, 1e-6);
  if (r <= rc) return omega * r; // solid-body core
  return (omega * rc * rc) / Math.max(r, 1e-6); // free vortex outside
}

/**
 * Angular speed ω(r) = vθ(r)/r at radius r — what actually advances a particle's
 * angle each frame. Constant (= ω) inside the core, falling as 1/r² outside.
 */
export function angularSpeed(r: number, omega: number, rCore: number): number {
  const rr = Math.max(r, 1e-6);
  return tangentialSpeed(rr, omega, rCore) / rr;
}

/**
 * Effective angular speed after viscous damping. Higher μ → slower rotation
 * (brief: "เพิ่มความหนืด การหมุนควรถูกหน่วงลง").
 */
export function effectiveOmega(omega: number, mu: number): number {
  return omega / (1 + VISCOSITY_DAMP_K * Math.max(mu, 0));
}

/**
 * Effective core radius after viscosity. Higher μ enlarges the solid-body core
 * so the field looks smoother / more rigid-body-like (brief: "ดูเรียบขึ้น").
 * Clamped to stay within the tank.
 */
export function effectiveCore(rCore: number, mu: number, tankRadius: number): number {
  const grown = rCore * (1 + VISCOSITY_CORE_K * Math.max(mu, 0));
  return clamp(grown, 1e-6, tankRadius * 0.98);
}

/** A particle orbiting the vortex centre at (roughly) fixed radius. */
export interface VortexParticle {
  /** Radius from centre as a fraction of tank radius, in [0.02, 0.99]. */
  rf: number;
  /** Current angle (rad), advanced each frame by the local angular speed. */
  angle: number;
}

/** Seed particles spread over the tank with a slight bias toward the centre. */
export function seedParticles(count: number): VortexParticle[] {
  const out: VortexParticle[] = [];
  for (let i = 0; i < count; i++) {
    // sqrt keeps the spatial density roughly uniform over the disc area while
    // a small floor avoids a clump exactly at the singular centre.
    const rf = clamp(Math.sqrt(Math.random()) * 0.97 + 0.02, 0.02, 0.99);
    out.push({ rf, angle: Math.random() * Math.PI * 2 });
  }
  return out;
}
