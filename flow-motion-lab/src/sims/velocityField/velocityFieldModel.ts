/**
 * Model for the Velocity Field Explorer (Fluid Kinematics).
 *
 * A 2-D velocity field is built from the classic potential-flow building blocks
 * the learner can switch between:
 *
 *   uniform   u = (U, 0)                       — constant everywhere
 *   source    vr = +m / (2π r)                 — pushes radially outward
 *   sink      vr = −m / (2π r)                 — pulls radially inward
 *   vortex    vθ =  Γ / (2π r)                 — circulates around the centre
 *   combined  source + uniform stream          — a Rankine half-body
 *
 * Every field is sampled by `velocityAt(x, y, kind, params)` which returns the
 * Cartesian components plus the (capped) local speed. Speed is capped near the
 * singular points (r → 0 for source/sink/vortex) so arrows and particles never
 * fly off-screen.
 *
 * Coordinates are centred: the singularity sits at world origin (0, 0).
 * Pure functions only — no side effects.
 */
import { clamp } from "@/lib/math";

/** The five field presets the learner can pick. */
export type FieldKind = "uniform" | "source" | "sink" | "vortex" | "combined";

/** Order used by the ToggleChip group and the numeric guided-step sentinel. */
export const FIELD_ORDER: FieldKind[] = [
  "uniform",
  "source",
  "sink",
  "vortex",
  "combined",
];

/**
 * Field parameters. `strength` is reused per field (U / m / Γ); `secondary`
 * is the free-stream speed U added to the source in the combined field.
 */
export interface FieldParams {
  /** Primary strength: U (uniform), m (source/sink), Γ (vortex), m (combined). */
  strength: number;
  /** Secondary strength: free-stream U added to the source in `combined`. */
  secondary: number;
}

/** A 2-D velocity sample plus its (capped) speed magnitude, in field units. */
export interface FieldVelocity {
  vx: number;
  vy: number;
  speed: number;
}

/** Radius below which a singular field is treated as the capped core. */
const CORE_RADIUS = 0.45;
/** Upper bound on local speed so singular points stay drawable. */
const SPEED_CAP = 6;

/**
 * Local velocity of the chosen field at world point (x, y).
 *
 * Guards r → 0 for the source/sink/vortex by clamping the effective radius to
 * `CORE_RADIUS`, then caps the resulting speed at `SPEED_CAP` so the vectors and
 * advected particles never blow up near a singularity.
 */
export function velocityAt(
  x: number,
  y: number,
  kind: FieldKind,
  params: FieldParams,
): FieldVelocity {
  const { strength, secondary } = params;
  let vx = 0;
  let vy = 0;

  switch (kind) {
    case "uniform": {
      // Uniform stream u = (U, 0).
      vx = strength;
      vy = 0;
      break;
    }
    case "source": {
      // Radial source: vr = +m / (2π r), pointing outward.
      const r = Math.max(Math.hypot(x, y), CORE_RADIUS);
      const vr = strength / (2 * Math.PI * r);
      vx = (x / r) * vr;
      vy = (y / r) * vr;
      break;
    }
    case "sink": {
      // Radial sink: vr = −m / (2π r), pointing inward.
      const r = Math.max(Math.hypot(x, y), CORE_RADIUS);
      const vr = strength / (2 * Math.PI * r);
      vx = -(x / r) * vr;
      vy = -(y / r) * vr;
      break;
    }
    case "vortex": {
      // Free vortex: vθ = Γ / (2π r), tangential (counter-clockwise).
      const r = Math.max(Math.hypot(x, y), CORE_RADIUS);
      const vTheta = strength / (2 * Math.PI * r);
      vx = (-y / r) * vTheta;
      vy = (x / r) * vTheta;
      break;
    }
    case "combined": {
      // Source + uniform stream → a Rankine half-body.
      const r = Math.max(Math.hypot(x, y), CORE_RADIUS);
      const vr = strength / (2 * Math.PI * r);
      vx = (x / r) * vr + secondary;
      vy = (y / r) * vr;
      break;
    }
  }

  // Cap the speed near singular points so arrows/particles stay on-screen.
  const raw = Math.hypot(vx, vy);
  if (raw > SPEED_CAP) {
    const scale = SPEED_CAP / raw;
    vx *= scale;
    vy *= scale;
    return { vx, vy, speed: SPEED_CAP };
  }
  return { vx, vy, speed: raw };
}

/** Whether the field has a singular point at the origin (source/sink/vortex/combined). */
export function hasSingularity(kind: FieldKind): boolean {
  return kind !== "uniform";
}

/** Number of singular points in the field (0 for uniform, 1 otherwise). */
export function singularCount(kind: FieldKind): number {
  return hasSingularity(kind) ? 1 : 0;
}

/**
 * The maximum (capped) speed the field produces over the visible world box —
 * sampled at the core radius for singular fields, exact for uniform. Used by the
 * result panel and for normalising vector lengths / particle colours.
 */
export function maxSpeed(kind: FieldKind, params: FieldParams): number {
  if (kind === "uniform") return Math.abs(params.strength);
  // Probe a ring of points at the core radius where singular fields peak.
  let peak = 0;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const x = Math.cos(ang) * CORE_RADIUS;
    const y = Math.sin(ang) * CORE_RADIUS;
    peak = Math.max(peak, velocityAt(x, y, kind, params).speed);
  }
  return peak;
}

/** Thai-first display name for a field kind. */
export function fieldLabel(kind: FieldKind): string {
  switch (kind) {
    case "uniform":
      return "การไหลสม่ำเสมอ (Uniform)";
    case "source":
      return "แหล่งกำเนิด (Source)";
    case "sink":
      return "แหล่งดูด (Sink)";
    case "vortex":
      return "วอร์เท็กซ์ (Vortex)";
    case "combined":
      return "สนามผสม Source + Uniform (Rankine)";
  }
}

/** Short Thai-first symbol/expression for the active field's velocity. */
export function fieldFormula(kind: FieldKind): string {
  switch (kind) {
    case "uniform":
      return "u = (U, 0)";
    case "source":
      return "v_r = +m / (2π r)";
    case "sink":
      return "v_r = −m / (2π r)";
    case "vortex":
      return "v_θ = Γ / (2π r)";
    case "combined":
      return "v = source(m) + uniform(U)";
  }
}

/** A particle advected by the velocity field (world coordinates, centred). */
export interface FieldParticle {
  /** World position (centred at origin), same units as velocityAt. */
  x: number;
  y: number;
  /** Per-particle random phase used to vary recycle positions. */
  seed: number;
}

/**
 * Seed a grid of particles filling a centred world box of half-extent `half`
 * (so x, y ∈ [-half, half]) with a small jitter so the lattice is not rigid.
 */
export function seedParticles(count: number, half: number): FieldParticle[] {
  const out: FieldParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: (Math.random() * 2 - 1) * half,
      y: (Math.random() * 2 - 1) * half,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/**
 * Recycle a particle that has drifted outside the world box, or fallen into the
 * singular core (where it would otherwise stall), to a fresh random position so
 * the field stays populated. Returns true if it was recycled.
 */
export function recycleParticle(
  p: FieldParticle,
  half: number,
  kind: FieldKind,
): boolean {
  const margin = half * 1.05;
  const out =
    p.x > margin || p.x < -margin || p.y > margin || p.y < -margin;
  // Sinks pull particles into the core; re-emit them from the edges.
  const swallowed =
    (kind === "sink") && Math.hypot(p.x, p.y) < CORE_RADIUS * 1.1;
  if (out || swallowed) {
    if (kind === "sink" || kind === "uniform" || kind === "combined") {
      // Re-enter from the left/edge band so the streamwise flow stays fed.
      p.x = -half;
      p.y = (Math.random() * 2 - 1) * half;
    } else {
      // Source/vortex: re-seed near the core so particles spiral/spread out.
      p.x = clamp((Math.random() * 2 - 1) * CORE_RADIUS * 1.5, -half, half);
      p.y = clamp((Math.random() * 2 - 1) * CORE_RADIUS * 1.5, -half, half);
    }
    p.seed = Math.random() * Math.PI * 2;
    return true;
  }
  return false;
}
