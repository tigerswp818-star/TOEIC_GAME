/**
 * Model + data for the Dimension Checker (Dimensional Homogeneity) sim.
 *
 * Every physical quantity has a dimension expressed in the three SI base
 * dimensions used here: Mass [M], Length [L] and Time [T]. A dimension is
 * therefore a vector of three exponents [a, b, c] meaning Mᵃ Lᵇ Tᶜ.
 *
 * A candidate equation is "dimensionally homogeneous" when BOTH sides reduce
 * to the SAME [M, L, T] exponent vector. This module supplies:
 *   - QUANTITIES: a table mapping symbols to their [M, L, T] exponents,
 *   - combinator helpers (multiply → add exponents, power → scale exponents),
 *   - a set of preset EQUATIONS to test,
 *   - dimensionsOf(side) and isHomogeneous(eq).
 *
 * Pure data + pure functions only — no React, no side effects.
 */

/** A dimension expressed as exponents of the base dimensions [M, L, T]. */
export type Dim = readonly [number, number, number];

/** The dimensionless quantity, [M⁰ L⁰ T⁰]. */
export const DIMENSIONLESS: Dim = [0, 0, 0];

/** Names of the three base dimensions, in canonical order. */
export const BASE_DIMENSIONS: { symbol: string; th: string; en: string }[] = [
  { symbol: "M", th: "มวล", en: "Mass" },
  { symbol: "L", th: "ความยาว", en: "Length" },
  { symbol: "T", th: "เวลา", en: "Time" },
];

/** Metadata for a physics quantity and its base-dimension exponents. */
export interface Quantity {
  /** Symbol used inside equation factor lists, e.g. "rho", "g", "V". */
  key: string;
  /** Pretty symbol shown to the learner, e.g. "ρ", "g", "V". */
  symbol: string;
  th: string;
  en: string;
  dim: Dim;
}

/**
 * Quantity table: physics quantities → [M, L, T] exponents.
 * (Pressure = [1,−1,−2], ρ = [1,−3,0], g = [0,1,−2], h = [0,1,0],
 *  V = [0,1,−1], A = [0,2,0], Q = [0,3,−1], F = [1,1,−2], μ = [1,−1,−1], …)
 */
export const QUANTITIES: Record<string, Quantity> = {
  P: { key: "P", symbol: "P", th: "ความดัน", en: "Pressure", dim: [1, -1, -2] },
  rho: { key: "rho", symbol: "ρ", th: "ความหนาแน่น", en: "Density", dim: [1, -3, 0] },
  g: { key: "g", symbol: "g", th: "ความเร่งโน้มถ่วง", en: "Gravity", dim: [0, 1, -2] },
  h: { key: "h", symbol: "h", th: "ความสูง", en: "Height", dim: [0, 1, 0] },
  V: { key: "V", symbol: "V", th: "ความเร็ว", en: "Velocity", dim: [0, 1, -1] },
  A: { key: "A", symbol: "A", th: "พื้นที่หน้าตัด", en: "Area", dim: [0, 2, 0] },
  Q: { key: "Q", symbol: "Q", th: "อัตราการไหลเชิงปริมาตร", en: "Flow rate", dim: [0, 3, -1] },
  F: { key: "F", symbol: "F", th: "แรง", en: "Force", dim: [1, 1, -2] },
  mu: { key: "mu", symbol: "μ", th: "ความหนืดพลวัต", en: "Dynamic viscosity", dim: [1, -1, -1] },
  m: { key: "m", symbol: "m", th: "มวล", en: "Mass", dim: [1, 0, 0] },
  L: { key: "L", symbol: "L", th: "ความยาว", en: "Length", dim: [0, 1, 0] },
  t: { key: "t", symbol: "t", th: "เวลา", en: "Time", dim: [0, 0, 1] },
};

/** Look up a quantity by key, throwing on an unknown symbol (caught at authoring time). */
export function quantity(key: string): Quantity {
  const q = QUANTITIES[key];
  if (!q) throw new Error(`Unknown quantity "${key}"`);
  return q;
}

/* ----------------------------- dimension algebra ---------------------------- */

/** Multiply two dimensions → add their exponents. */
export function multiplyDim(a: Dim, b: Dim): Dim {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Divide two dimensions → subtract their exponents. */
export function divideDim(a: Dim, b: Dim): Dim {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Raise a dimension to a (possibly fractional) power → scale its exponents. */
export function powerDim(a: Dim, p: number): Dim {
  return [a[0] * p, a[1] * p, a[2] * p];
}

/** True when two dimensions have identical exponents (with a tiny tolerance). */
export function sameDim(a: Dim, b: Dim): boolean {
  return (
    Math.abs(a[0] - b[0]) < 1e-9 &&
    Math.abs(a[1] - b[1]) < 1e-9 &&
    Math.abs(a[2] - b[2]) < 1e-9
  );
}

/* ----------------------------- equation model ------------------------------ */

/**
 * One factor in a product describing a side of an equation: a quantity raised
 * to a power. e.g. ρ·g·h is [{key:"rho"},{key:"g"},{key:"h"}]; V² is
 * [{key:"V",power:2}]; √(2gh) is [{key:"g",power:0.5},{key:"h",power:0.5}].
 * Pure numeric constants (like 2 or ½) are dimensionless and so are omitted.
 */
export interface Factor {
  key: string;
  /** Exponent applied to this factor (default 1). */
  power?: number;
}

/** A side of an equation = a product of factors (multiply → add exponents). */
export type Side = Factor[];

/** A candidate equation to test for dimensional homogeneity. */
export interface Equation {
  id: string;
  /** Human-readable form shown to the learner, e.g. "P = ρgh". */
  display: string;
  th: string;
  /** Left-hand-side factors. */
  lhs: Side;
  /** Right-hand-side factors. */
  rhs: Side;
  /** Whether this equation is dimensionally balanced (authoring ground truth). */
  balanced: boolean;
}

/** Reduce one side (a product of powered factors) to its [M, L, T] dimension. */
export function dimensionsOf(side: Side): Dim {
  return side.reduce<Dim>(
    (acc, f) => multiplyDim(acc, powerDim(quantity(f.key).dim, f.power ?? 1)),
    DIMENSIONLESS,
  );
}

/** True when both sides of the equation reduce to the same dimension. */
export function isHomogeneous(eq: Equation): boolean {
  return sameDim(dimensionsOf(eq.lhs), dimensionsOf(eq.rhs));
}

/**
 * Format a dimension as a readable string with superscripts, e.g.
 * [1,-1,-2] → "[M L⁻¹ T⁻²]" and [0,0,0] → "[ไม่มีมิติ]".
 */
const SUPERSCRIPTS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  ".": "·",
};

function superscript(n: number): string {
  // Render whole numbers cleanly; fractional exponents fall back to a slash form.
  const rounded = Math.round(n * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return str
    .split("")
    .map((ch) => SUPERSCRIPTS[ch] ?? ch)
    .join("");
}

/** Format a dimension vector as "[M L⁻¹ T⁻²]" style text (Thai-friendly). */
export function formatDim(dim: Dim): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const exp = dim[i];
    if (Math.abs(exp) < 1e-9) continue; // exponent 0 → omit the base entirely
    const base = BASE_DIMENSIONS[i].symbol;
    parts.push(exp === 1 ? base : `${base}${superscript(exp)}`);
  }
  if (parts.length === 0) return "[ไม่มีมิติ]";
  return `[${parts.join(" ")}]`;
}

/** Compact form used on the balance pans, e.g. "M¹ L⁻¹ T⁻²" (always all three). */
export function formatDimFull(dim: Dim): string {
  return BASE_DIMENSIONS.map((b, i) => `${b.symbol}${superscript(dim[i])}`).join(" ");
}

/* ------------------------------ preset equations --------------------------- */

/**
 * The equations the learner can test. Mix of balanced (✓) and unbalanced (✗)
 * cases. Pure numeric constants are dimensionless and so are left out of the
 * factor lists (they never affect dimensions).
 */
export const EQUATIONS: Equation[] = [
  {
    id: "P=rho_g_h",
    display: "P = ρgh",
    th: "ความดันอุทกสถิต P = ρgh",
    lhs: [{ key: "P" }],
    rhs: [{ key: "rho" }, { key: "g" }, { key: "h" }],
    balanced: true,
  },
  {
    id: "P=rho_g",
    display: "P = ρg",
    th: "P = ρg (ขาด h)",
    lhs: [{ key: "P" }],
    rhs: [{ key: "rho" }, { key: "g" }],
    balanced: false,
  },
  {
    id: "Q=A_V",
    display: "Q = AV",
    th: "อัตราการไหล Q = AV",
    lhs: [{ key: "Q" }],
    rhs: [{ key: "A" }, { key: "V" }],
    balanced: true,
  },
  {
    id: "F=rho_V2_A",
    display: "F = ρV²A",
    th: "แรงพลวัต F = ρV²A (ความดันพลวัต × พื้นที่)",
    lhs: [{ key: "F" }],
    rhs: [{ key: "rho" }, { key: "V", power: 2 }, { key: "A" }],
    balanced: true,
  },
  {
    id: "V=sqrt_2gh",
    display: "V = √(2gh)",
    th: "ความเร็วทอร์ริเชลลี V = √(2gh)",
    lhs: [{ key: "V" }],
    rhs: [{ key: "g", power: 0.5 }, { key: "h", power: 0.5 }],
    balanced: true,
  },
  {
    id: "P=rho_V",
    display: "P = ρV",
    th: "P = ρV (มิติไม่ตรง)",
    lhs: [{ key: "P" }],
    rhs: [{ key: "rho" }, { key: "V" }],
    balanced: false,
  },
];

/** Indices of a balanced and an unbalanced equation (for guided/challenges). */
export const FIRST_BALANCED_INDEX = EQUATIONS.findIndex((e) => e.balanced);
export const FIRST_UNBALANCED_INDEX = EQUATIONS.findIndex((e) => !e.balanced);

/** The numeric result object that Challenge predicates run against. */
export interface DimResult {
  /** Index of the active equation in EQUATIONS (numeric sentinel). */
  eqIndex: number;
  /** 1 when both sides match, 0 when they don't. */
  balanced: number;
}

/** Build the live numeric result for the current selection. */
export function buildResult(eqIndex: number): DimResult {
  const eq = EQUATIONS[Math.max(0, Math.min(eqIndex, EQUATIONS.length - 1))];
  return {
    eqIndex,
    balanced: isHomogeneous(eq) ? 1 : 0,
  };
}
