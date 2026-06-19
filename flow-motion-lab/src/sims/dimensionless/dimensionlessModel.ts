/**
 * Physics + metadata for the Dimensionless Number Explorer.
 *
 * The learner picks a SCENARIO; each scenario highlights one governing
 * dimensionless group (Reynolds, Froude, Mach, Weber). Every scenario fixes
 * sensible reference properties (density, length, viscosity / sound speed /
 * surface tension) so that a single velocity slider drives the active number
 * live.
 *
 * Pure functions + plain data, no React, no side effects. SI units throughout.
 */
import { GRAVITY } from "@/lib/constants";
import { clamp } from "@/lib/math";

/** Scenario index used as a numeric sentinel in the UI ToggleChip state. */
export const SCENARIO_PIPE = 0;
export const SCENARIO_CHANNEL = 1;
export const SCENARIO_AIRCRAFT = 2;
export const SCENARIO_SURFACE = 3;

/** Short symbol for the active dimensionless number. */
export type DimlessSymbol = "Re" | "Fr" | "Ma" | "We";

/** One entry in the catalogue of dimensionless numbers / scenarios. */
export interface DimensionlessInfo {
  /** Scenario index (matches the SCENARIO_* sentinels). */
  index: number;
  /** Short symbol, e.g. "Re". */
  symbol: DimlessSymbol;
  /** Full English name. */
  name: string;
  /** Thai name. */
  nameTh: string;
  /** Scenario label (Thai + English). */
  scenario: string;
  /** Emoji used for the scenario chip. */
  icon: string;
  /** Compact formula string, e.g. "Re = ρVD/μ". */
  formula: string;
  /** What the number compares (Thai), e.g. "แรงเฉื่อย vs แรงหนืด". */
  compares: string;
  /** What the number compares (English), e.g. "inertia vs viscous". */
  comparesEn: string;
  /** Fixed reference properties for this scenario (drive the live value). */
  fixed: DimensionlessFixed;
  /** Glossary rows for the FormulaCard. */
  variables: { symbol: string; meaning: string; unit?: string }[];
}

/**
 * Reference properties held fixed per scenario. Only the fields each number
 * needs are meaningful; unused fields are simply ignored by `computeNumber`.
 */
export interface DimensionlessFixed {
  /** Density ρ (kg/m³). */
  rho?: number;
  /** Characteristic length / diameter / depth L or D (m). */
  length?: number;
  /** Dynamic viscosity μ (Pa·s) — Reynolds. */
  mu?: number;
  /** Speed of sound a (m/s) — Mach. */
  a?: number;
  /** Surface tension σ (N/m) — Weber. */
  sigma?: number;
  /** Plain-language Thai description of the fixed reference. */
  note: string;
}

/**
 * Catalogue of the four scenarios / dimensionless numbers. Order matches the
 * SCENARIO_* sentinels so `DIMENSIONLESS[index]` is always the active entry.
 */
export const DIMENSIONLESS: DimensionlessInfo[] = [
  {
    index: SCENARIO_PIPE,
    symbol: "Re",
    name: "Reynolds number",
    nameTh: "เลขเรย์โนลด์",
    scenario: "การไหลในท่อ Pipe flow",
    icon: "🚰",
    formula: "Re = ρVD/μ",
    compares: "แรงเฉื่อย vs แรงหนืด",
    comparesEn: "inertia vs viscous",
    fixed: {
      rho: 1000, // น้ำ
      length: 0.05, // เส้นผ่านศูนย์กลางท่อ D
      mu: 0.001, // ความหนืดน้ำ
      note: "ของไหลคือน้ำ (ρ = 1000 kg/m³, μ = 0.001 Pa·s) ในท่อ D = 0.05 m",
    },
    variables: [
      { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
      { symbol: "D", meaning: "เส้นผ่านศูนย์กลางท่อ Diameter", unit: "m" },
      { symbol: "μ", meaning: "ความหนืด Viscosity", unit: "Pa·s" },
    ],
  },
  {
    index: SCENARIO_CHANNEL,
    symbol: "Fr",
    name: "Froude number",
    nameTh: "เลขฟรูด",
    scenario: "ทางน้ำเปิด Open channel",
    icon: "🌊",
    formula: "Fr = V/√(gD)",
    compares: "แรงเฉื่อย vs แรงโน้มถ่วง",
    comparesEn: "inertia vs gravity",
    fixed: {
      length: 0.6, // ความลึกน้ำ D
      note: "น้ำในทางเปิดลึก D = 0.6 m, g = 9.81 m/s²",
    },
    variables: [
      { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
      { symbol: "D", meaning: "ความลึกน้ำ Depth", unit: "m" },
    ],
  },
  {
    index: SCENARIO_AIRCRAFT,
    symbol: "Ma",
    name: "Mach number",
    nameTh: "เลขมัค",
    scenario: "อากาศยาน/อัดตัวได้ Aircraft",
    icon: "✈️",
    formula: "Ma = V/a",
    compares: "ความเร็ว vs ความเร็วเสียง",
    comparesEn: "speed vs sound",
    fixed: {
      a: 340, // ความเร็วเสียงในอากาศ
      note: "อากาศที่ระดับน้ำทะเล ความเร็วเสียง a ≈ 340 m/s",
    },
    variables: [
      { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
      { symbol: "a", meaning: "ความเร็วเสียง Speed of sound", unit: "m/s" },
    ],
  },
  {
    index: SCENARIO_SURFACE,
    symbol: "We",
    name: "Weber number",
    nameTh: "เลขเวเบอร์",
    scenario: "ปัญหาแรงตึงผิว Surface tension",
    icon: "💧",
    formula: "We = ρV²L/σ",
    compares: "แรงเฉื่อย vs แรงตึงผิว",
    comparesEn: "inertia vs surface tension",
    fixed: {
      rho: 1000, // น้ำ
      length: 0.003, // ขนาดหยด/เจ็ต L
      sigma: 0.072, // แรงตึงผิวน้ำ
      note: "หยดน้ำ ρ = 1000 kg/m³, L = 0.003 m, σ = 0.072 N/m",
    },
    variables: [
      { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
      { symbol: "L", meaning: "ขนาดลักษณะเฉพาะ Length", unit: "m" },
      { symbol: "σ", meaning: "แรงตึงผิว Surface tension", unit: "N/m" },
    ],
  },
];

/** Clamp a scenario index into the valid range. */
export function scenarioAt(index: number): DimensionlessInfo {
  const i = clamp(Math.round(index), 0, DIMENSIONLESS.length - 1);
  return DIMENSIONLESS[i];
}

/** Reynolds number Re = ρVD/μ. */
export function reFromVelocity(v: number, fx: DimensionlessFixed): number {
  return ((fx.rho ?? 1000) * v * (fx.length ?? 0.05)) / Math.max(fx.mu ?? 0.001, 1e-9);
}

/** Froude number Fr = V/√(gD). */
export function frFromVelocity(v: number, fx: DimensionlessFixed): number {
  return v / Math.sqrt(GRAVITY * Math.max(fx.length ?? 0.6, 1e-6));
}

/** Mach number Ma = V/a. */
export function maFromVelocity(v: number, fx: DimensionlessFixed): number {
  return v / Math.max(fx.a ?? 340, 1e-6);
}

/** Weber number We = ρV²L/σ. */
export function weFromVelocity(v: number, fx: DimensionlessFixed): number {
  return ((fx.rho ?? 1000) * v * v * (fx.length ?? 0.003)) / Math.max(fx.sigma ?? 0.072, 1e-9);
}

/** Compute the active dimensionless number for a scenario at velocity V. */
export function computeNumber(index: number, v: number): number {
  const info = scenarioAt(index);
  switch (info.symbol) {
    case "Re":
      return reFromVelocity(v, info.fixed);
    case "Fr":
      return frFromVelocity(v, info.fixed);
    case "Ma":
      return maFromVelocity(v, info.fixed);
    case "We":
      return weFromVelocity(v, info.fixed);
  }
}

/**
 * Build the live substituted-formula string for the FormulaCard, e.g.
 * "Re = (1000)(2)(0.05) / 0.001 ≈ 100000".
 */
export function substitutedFormula(index: number, v: number, value: number): string {
  const info = scenarioAt(index);
  const fx = info.fixed;
  const f = (n: number, d = 2) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
  const approx = value >= 1e5 ? value.toExponential(2) : f(value, value < 10 ? 2 : 0);
  switch (info.symbol) {
    case "Re":
      return `Re = (${f(fx.rho ?? 0, 0)})(${f(v)})(${f(fx.length ?? 0, 3)}) / ${f(fx.mu ?? 0, 4)} ≈ ${approx}`;
    case "Fr":
      return `Fr = ${f(v)} / √(${GRAVITY} × ${f(fx.length ?? 0, 2)}) ≈ ${approx}`;
    case "Ma":
      return `Ma = ${f(v)} / ${f(fx.a ?? 0, 0)} ≈ ${approx}`;
    case "We":
      return `We = (${f(fx.rho ?? 0, 0)})(${f(v)})²(${f(fx.length ?? 0, 3)}) / ${f(fx.sigma ?? 0, 3)} ≈ ${approx}`;
  }
}

/**
 * Regime / threshold description for a scenario at a given value.
 * Returns the qualitative label plus a Thai explanation of what it means.
 */
export interface RegimeInfo {
  /** Thai label, e.g. "เหนือเสียง". */
  label: string;
  /** Badge tone matching the ExplanationPanel API. */
  tone: "cyan" | "amber" | "rose" | "emerald";
  /** Thai sentence explaining the regime / threshold. */
  text: string;
}

export function regimeFor(index: number, value: number): RegimeInfo {
  const info = scenarioAt(index);
  switch (info.symbol) {
    case "Re": {
      if (value < 2300)
        return {
          label: "Laminar ราบเรียบ",
          tone: "emerald",
          text: "Re < 2300 → การไหลแบบ Laminar (ราบเรียบ) แรงหนืดควบคุมการไหลได้ดี เส้นการไหลขนานกัน",
        };
      if (value <= 4000)
        return {
          label: "Transitional เปลี่ยนผ่าน",
          tone: "amber",
          text: "2300 ≤ Re ≤ 4000 → ช่วงเปลี่ยนผ่าน เส้นการไหลเริ่มสั่น แรงเฉื่อยกับแรงหนืดสูสีกัน",
        };
      return {
        label: "Turbulent ปั่นป่วน",
        tone: "rose",
        text: "Re > 4000 → การไหลแบบ Turbulent (ปั่นป่วน) แรงเฉื่อยมีอิทธิพลเหนือแรงหนืด เกิดการหมุนวน",
      };
    }
    case "Fr": {
      if (value < 1)
        return {
          label: "Subcritical ใต้วิกฤต",
          tone: "emerald",
          text: "Fr < 1 → การไหลแบบ Subcritical (ใต้วิกฤต) คลื่นเดินทางทวนน้ำได้ การไหลช้าและลึก",
        };
      if (value < 1.05)
        return {
          label: "Critical วิกฤต",
          tone: "amber",
          text: "Fr ≈ 1 → การไหลแบบ Critical (วิกฤต) ความเร็วน้ำเท่ากับความเร็วคลื่นผิวน้ำพอดี",
        };
      return {
        label: "Supercritical เหนือวิกฤต",
        tone: "rose",
        text: "Fr > 1 → การไหลแบบ Supercritical (เหนือวิกฤต) แรงเฉื่อยชนะแรงโน้มถ่วง คลื่นเดินทวนน้ำไม่ได้ (เช่น น้ำเชี่ยว)",
      };
    }
    case "Ma": {
      if (value < 0.8)
        return {
          label: "Subsonic ต่ำกว่าเสียง",
          tone: "emerald",
          text: "Ma < 0.8 → Subsonic (ช้ากว่าเสียง) ผลของการอัดตัวของอากาศยังน้อย",
        };
      if (value < 1)
        return {
          label: "Transonic ใกล้เสียง",
          tone: "amber",
          text: "0.8 ≤ Ma < 1 → Transonic (ใกล้ความเร็วเสียง) เริ่มเกิดผลการอัดตัวรุนแรง",
        };
      return {
        label: "Supersonic เหนือเสียง",
        tone: "rose",
        text: "Ma > 1 → Supersonic (เหนือเสียง) วัตถุเร็วกว่าเสียง เกิดคลื่นกระแทก (shock wave) รูปกรวย",
      };
    }
    case "We": {
      if (value < 1)
        return {
          label: "แรงตึงผิวชนะ",
          tone: "emerald",
          text: "We < 1 → แรงตึงผิวมีอิทธิพลมากกว่าแรงเฉื่อย หยดคงรูปทรงกลมไว้ได้ ไม่แตกตัว",
        };
      if (value < 12)
        return {
          label: "เริ่มผิดรูป",
          tone: "amber",
          text: "We ปานกลาง → แรงเฉื่อยเริ่มสูสีกับแรงตึงผิว หยด/เจ็ตเริ่มผิดรูปและสั่น",
        };
      return {
        label: "หยดแตกตัว",
        tone: "rose",
        text: "We สูง → แรงเฉื่อยชนะแรงตึงผิว หยดหรือเจ็ตจะแตกตัว (breakup) เป็นละอองเล็ก ๆ",
      };
    }
  }
}

/**
 * A normalised "intensity" in [0,1] for driving animation magnitude from the
 * active number, mapped per scenario onto a representative range.
 */
export function intensityFor(index: number, value: number): number {
  const info = scenarioAt(index);
  switch (info.symbol) {
    case "Re":
      return clamp(value / 6000, 0, 1); // 0 → laminar, 1 → fully turbulent
    case "Fr":
      return clamp(value / 2, 0, 1); // 1.0 maps to 0.5 (critical)
    case "Ma":
      return clamp(value / 1.5, 0, 1); // 1.0 maps to ~0.67
    case "We":
      return clamp(value / 40, 0, 1); // higher → more breakup
  }
}

/** A simple particle used by every scenario's representative animation. */
export interface DimParticle {
  /** Normalised horizontal position 0→1. */
  xf: number;
  /** Cross-stream fraction in [-1, 1]. */
  f: number;
  /** Per-particle phase so motion looks uncorrelated. */
  seed: number;
}

export function seedParticles(count: number): DimParticle[] {
  const out: DimParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      f: (Math.random() * 2 - 1) * 0.85,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

/** Speed scenarios are driven by velocity; share a normalised-x speed factor. */
export const FLOW_SPEED = 0.12;
