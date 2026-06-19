/**
 * Physics + particle model for the Model & Prototype Similarity simulation
 * (chapter: Dimensional Analysis).
 *
 * For a scaled MODEL to behave like the full-size PROTOTYPE (dynamic similarity)
 * the governing dimensionless number must be EQUAL for both. Two regimes:
 *
 *  - Reynolds similarity (submerged / pipe flow, viscous forces dominate):
 *        Re = ρ V L / μ
 *    Matching Re in the SAME fluid (same ρ, μ) requires
 *        V_m = V_p · (L_p / L_m) = V_p / λ        (model runs FASTER)
 *
 *  - Froude similarity (free-surface / ship flow, gravity waves dominate):
 *        Fr = V / √(g L)
 *    Matching Fr requires
 *        V_m = V_p · √(L_m / L_p) = V_p · √λ       (model runs SLOWER)
 *
 *  where λ = L_m / L_p is the geometric scale (0 < λ ≤ 1).
 *
 * All functions are pure, SI units, and guard against non-physical input so a
 * mid-drag slider value can never produce NaN/Infinity.
 */
import { GRAVITY, RHO_WATER, MU_WATER } from "@/lib/constants";

/** The governing dimensionless number the user chooses to match. */
export type SimilarityKind = "reynolds" | "froude";

const safe = (v: number, min = 1e-9): number =>
  Number.isFinite(v) ? Math.max(v, min) : min;

/** Model length L_m = λ · L_p  (m). */
export function modelLength(lp: number, lambda: number): number {
  return Math.max(lp, 0) * safe(lambda);
}

/** Reynolds number Re = ρ V L / μ  (dimensionless), default fluid = water. */
export function reynolds(
  v: number,
  l: number,
  rho: number = RHO_WATER,
  mu: number = MU_WATER,
): number {
  return (rho * Math.max(v, 0) * Math.max(l, 0)) / safe(mu);
}

/** Froude number Fr = V / √(g L)  (dimensionless). */
export function froude(v: number, l: number, g: number = GRAVITY): number {
  return Math.max(v, 0) / Math.sqrt(safe(g) * safe(l));
}

/**
 * Required MODEL velocity so the chosen number matches the prototype.
 *  - Reynolds (same fluid): V_m = V_p / λ
 *  - Froude:                V_m = V_p · √λ
 */
export function requiredModelVelocity(
  kind: SimilarityKind,
  vp: number,
  lambda: number,
): number {
  const l = safe(lambda);
  return kind === "reynolds" ? Math.max(vp, 0) / l : Math.max(vp, 0) * Math.sqrt(l);
}

/** Everything the UI needs in one pass: lengths, required V_m, and both numbers. */
export interface SimilarityResult {
  /** Geometric scale λ = L_m / L_p. */
  lambda: number;
  /** Prototype length L_p (m). */
  lp: number;
  /** Model length L_m (m). */
  lm: number;
  /** Prototype velocity V_p (m/s). */
  vp: number;
  /** Required model velocity V_m (m/s) for the chosen similarity. */
  vm: number;
  /** Governing number value on the PROTOTYPE. */
  numberProto: number;
  /** Governing number value on the MODEL (should equal numberProto). */
  numberModel: number;
  /** Which number is being matched. */
  kind: SimilarityKind;
}

/**
 * Solve the full similarity problem. The matched number is computed for BOTH
 * the prototype and the model (using the required V_m) so the UI can show they
 * read EQUAL — the heart of dynamic similarity.
 */
export function solveSimilarity(
  kind: SimilarityKind,
  lp: number,
  vp: number,
  lambda: number,
): SimilarityResult {
  const lm = modelLength(lp, lambda);
  const vm = requiredModelVelocity(kind, vp, lambda);

  const numberProto = kind === "reynolds" ? reynolds(vp, lp) : froude(vp, lp);
  const numberModel = kind === "reynolds" ? reynolds(vm, lm) : froude(vm, lm);

  return { lambda, lp, lm, vp, vm, numberProto, numberModel, kind };
}

/** A particle flowing left→right past an object along a streamline lane. */
export interface SimParticle {
  /** Normalised horizontal position 0→1 across the object's flow band. */
  xf: number;
  /** Streamline fraction in [-1, 1] (share of the band half-height). */
  f: number;
}

/** Seed a fresh set of particles spread across a flow band. */
export function seedParticles(count: number): SimParticle[] {
  const out: SimParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.92 });
  }
  return out;
}
