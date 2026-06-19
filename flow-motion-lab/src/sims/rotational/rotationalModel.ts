/**
 * Model for the Rotational vs Irrotational simulation (Fluid Kinematics).
 *
 * Small "paddle wheels" are dropped into a 2-D velocity field and advected by
 * the local flow. A paddle wheel only *spins* if the flow has vorticity:
 *
 *   ω_z = ∂v/∂x − ∂u/∂y      (z-component of vorticity)
 *   spin rate of a fluid element = ω_z / 2  (its angular velocity)
 *
 * Key teaching point: a paddle can translate along curved streamlines without
 * spinning at all (irrotational), e.g. a free vortex everywhere except its
 * singular core. Spin appears only where vorticity is non-zero (forced vortex,
 * shear flow).
 *
 * Pure functions + lightweight paddle state, no side effects.
 */
import { clamp } from "@/lib/math";

/** The four field presets the learner can pick. */
export type FieldKind = "uniform" | "free" | "forced" | "shear";

/** Order used by the ToggleChip group and the numeric guided-step sentinel. */
export const FIELD_ORDER: FieldKind[] = ["uniform", "free", "forced", "shear"];

/** Field parameters. `strength` is reused per field; `gradient` only for shear. */
export interface FieldParams {
  /** General strength: U (uniform), Γ (free vortex), ω (forced vortex). */
  strength: number;
  /** Velocity gradient k for shear flow u = (k·y, 0). */
  gradient: number;
}

/** A 2-D velocity sample in field units. */
export interface Velocity {
  vx: number;
  vy: number;
}

/**
 * Local velocity of the chosen field at world point (x, y).
 *
 * Coordinates are centred: the vortex centre / shear origin is at (0, 0).
 * Guards r → 0 in the vortex fields so the centre never produces NaN/Infinity.
 */
export function velocityAt(
  x: number,
  y: number,
  kind: FieldKind,
  params: FieldParams,
): Velocity {
  const { strength, gradient } = params;
  switch (kind) {
    case "uniform":
      // Uniform stream u = (U, 0) — irrotational (no spin).
      return { vx: strength, vy: 0 };
    case "free": {
      // Free (potential) vortex: vθ = Γ / (2π r) → tangential, falls off 1/r.
      const r2 = x * x + y * y;
      const r = Math.sqrt(r2);
      if (r < 1e-3) return { vx: 0, vy: 0 }; // guard the singular core
      const vTheta = strength / (2 * Math.PI * r);
      // Tangential (counter-clockwise) unit vector: (-y/r, x/r).
      return { vx: (-y / r) * vTheta, vy: (x / r) * vTheta };
    }
    case "forced": {
      // Forced vortex / solid body: vθ = ω·r → rotates rigidly.
      // vx = -ω·y, vy = ω·x  (no singularity, finite at the centre).
      return { vx: -strength * y, vy: strength * x };
    }
    case "shear":
      // Simple shear u = (k·y, 0) — rotational, vorticity = -k.
      return { vx: gradient * y, vy: 0 };
    default:
      return { vx: 0, vy: 0 };
  }
}

/**
 * Vorticity ω_z = ∂v/∂x − ∂u/∂y at world point (x, y).
 *
 *   uniform:  0                          (irrotational)
 *   free:     0 everywhere except r = 0  (irrotational outside the core)
 *   forced:   2ω                         (rotational, constant)
 *   shear:    −k                         (rotational, constant)
 */
export function vorticity(
  x: number,
  y: number,
  kind: FieldKind,
  params: FieldParams,
): number {
  const { strength, gradient } = params;
  switch (kind) {
    case "uniform":
      return 0;
    case "free": {
      // ∇×v = 0 everywhere outside the singular core; treat the core as 0 too
      // (the spin there is concentrated/undefined — paddles only translate).
      const r = Math.sqrt(x * x + y * y);
      if (r < 1e-3) return 0; // guard r → 0
      return 0;
    }
    case "forced":
      // ∂(ωx)/∂x − ∂(−ωy)/∂y = ω + ω = 2ω.
      return 2 * strength;
    case "shear":
      // ∂v/∂x − ∂u/∂y = 0 − k = −k.
      return -gradient;
    default:
      return 0;
  }
}

/** Angular velocity of a fluid element (paddle-wheel spin rate) = ω_z / 2. */
export function spinRate(
  x: number,
  y: number,
  kind: FieldKind,
  params: FieldParams,
): number {
  return vorticity(x, y, kind, params) / 2;
}

/** A representative vorticity value for the field (used in the result panel). */
export function representativeVorticity(
  kind: FieldKind,
  params: FieldParams,
): number {
  // Sample a generic off-centre point so the free vortex reads a clean 0.
  return vorticity(1, 1, kind, params);
}

/** Whether the field is rotational (paddles spin) anywhere in the bulk flow. */
export function isRotational(kind: FieldKind, params: FieldParams): boolean {
  return Math.abs(representativeVorticity(kind, params)) > 1e-9;
}

/** Thai-first display name for a field kind. */
export function fieldLabel(kind: FieldKind): string {
  switch (kind) {
    case "uniform":
      return "การไหลสม่ำเสมอ (Uniform)";
    case "free":
      return "วอร์เท็กซ์อิสระ (Free vortex)";
    case "forced":
      return "วอร์เท็กซ์บังคับ (Forced / solid body)";
    case "shear":
      return "การไหลแบบเฉือน (Shear flow)";
  }
}

/** A paddle wheel: a position in world units plus its own glyph rotation. */
export interface PaddleWheel {
  /** World position (centred at origin), in the same units as velocityAt. */
  x: number;
  y: number;
  /** Glyph orientation (rad). Advanced by the local spin rate each frame. */
  angle: number;
}

/**
 * Seed a grid of paddle wheels filling a centred world box of half-extent
 * `half` (so x, y ∈ [-half, half]). A tiny jitter avoids a perfectly rigid
 * lattice and keeps the motion legible.
 */
export function seedWheels(cols: number, rows: number, half: number): PaddleWheel[] {
  const out: PaddleWheel[] = [];
  const stepX = (2 * half) / cols;
  const stepY = (2 * half) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const jitterX = (Math.random() - 0.5) * stepX * 0.3;
      const jitterY = (Math.random() - 0.5) * stepY * 0.3;
      out.push({
        x: -half + (i + 0.5) * stepX + jitterX,
        y: -half + (j + 0.5) * stepY + jitterY,
        angle: 0,
      });
    }
  }
  return out;
}

/**
 * Recycle a wheel that has drifted outside the world box back to a fresh
 * position so the field stays populated. Returns true if it was recycled.
 */
export function recycleWheel(w: PaddleWheel, half: number): boolean {
  const margin = half * 1.05;
  if (w.x > margin || w.x < -margin || w.y > margin || w.y < -margin) {
    // Re-enter from a random spot on the upstream/edge band, keep orientation
    // history reset so spinning fields keep looking fresh.
    w.x = clamp(-half + Math.random() * 2 * half, -half, half);
    w.y = clamp(-half + Math.random() * 2 * half, -half, half);
    w.angle = 0;
    return true;
  }
  return false;
}
