/**
 * Model + data for the Bernoulli Validity Checker.
 *
 * Bernoulli's equation (P/ρg + V²/2g + z = const along a streamline) is only
 * valid when FOUR assumptions hold simultaneously:
 *   1. steady          — การไหลคงตัว (ไม่เปลี่ยนตามเวลา)
 *   2. incompressible   — ของไหลอัดตัวไม่ได้ (ρ คงที่)
 *   3. inviscid         — ไม่มีความหนืด/แรงเสียดทาน (frictionless)
 *   4. streamline       — คิดตามแนวเส้นการไหลเดียว
 *
 * The learner picks a flow SCENARIO; this module reports which assumptions are
 * satisfied and an overall verdict. One control ("Mach-ish" speed) lets the
 * compressibility assumption flip as the gas approaches the speed of sound.
 *
 * Pure data + pure functions only — no React, no side effects.
 */
import { clamp } from "@/lib/math";

/** The four Bernoulli assumptions, in canonical order. */
export type AssumptionKey = "steady" | "incompressible" | "inviscid" | "streamline";

export const ASSUMPTION_ORDER: AssumptionKey[] = [
  "steady",
  "incompressible",
  "inviscid",
  "streamline",
];

/** Thai + English label for each assumption, for on-canvas chips and cards. */
export const ASSUMPTION_LABELS: Record<AssumptionKey, { th: string; en: string }> = {
  steady: { th: "คงตัว", en: "Steady" },
  incompressible: { th: "อัดตัวไม่ได้", en: "Incompressible" },
  inviscid: { th: "ไม่มีความหนืด", en: "Inviscid" },
  streamline: { th: "ตามเส้นการไหล", en: "Along a streamline" },
};

/** Map of which of the four assumptions are satisfied. */
export type AssumptionSet = Record<AssumptionKey, boolean>;

/** Overall verdict on whether Bernoulli applies. */
export type Validity = "valid" | "approximate" | "invalid";

/** Thai + English verdict labels (the headline string in the result grid). */
export const VALIDITY_LABELS: Record<Validity, { th: string; en: string }> = {
  valid: { th: "ใช้ได้เต็มที่", en: "Valid" },
  approximate: { th: "ใช้ได้แบบประมาณ", en: "Approximate" },
  invalid: { th: "ใช้ไม่ได้", en: "Invalid" },
};

/** Tone used by the adaptive explanation panel / badges. */
export const VALIDITY_TONE: Record<Validity, "emerald" | "amber" | "rose"> = {
  valid: "emerald",
  approximate: "amber",
  invalid: "rose",
};

/** A visual style the canvas uses to animate the active scenario. */
export type SceneKind =
  | "ideal" // smooth parallel streamlines
  | "viscous" // streamlines slowed near the walls (boundary layer)
  | "compressible" // density bands compressing/expanding
  | "turbulent" // chaotic eddies
  | "unsteady"; // pulsing / oscillating field

export interface Scenario {
  id: string;
  /** Short chip label. */
  th: string;
  en: string;
  icon: string;
  /** Which canvas animation represents this flow. */
  scene: SceneKind;
  /**
   * Base assumption set for this scenario at the default speed. The verdict
   * function may further downgrade `incompressible` for the gas scenario as the
   * Mach-ish speed rises.
   */
  base: AssumptionSet;
  /** Whether this scenario's compressibility depends on the speed slider. */
  speedSensitive: boolean;
  /** Thai-first explanation of WHY Bernoulli does / doesn't apply. */
  explainTh: string;
}

const all = (
  steady: boolean,
  incompressible: boolean,
  inviscid: boolean,
  streamline: boolean,
): AssumptionSet => ({ steady, incompressible, inviscid, streamline });

/**
 * The five scenarios the learner can choose between. Ordered from the textbook
 * ideal case through progressively more "real" flows that break assumptions.
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "ideal",
    th: "การไหลในอุดมคติไม่มีแรงเสียดทาน",
    en: "Ideal frictionless flow",
    icon: "✨",
    scene: "ideal",
    base: all(true, true, true, true),
    speedSensitive: false,
    explainTh:
      "การไหลในอุดมคติ: คงตัว อัดตัวไม่ได้ ไม่มีความหนืด และคิดตามแนวเส้นการไหลเดียว ครบทั้ง 4 ข้อ จึงใช้สมการเบอร์นูลลีได้เต็มที่ ผลรวม P/ρg + V²/2g + z คงที่ตลอดแนว streamline อย่างแม่นยำ",
  },
  {
    id: "viscous",
    th: "การไหลในท่อจริงมีความหนืด",
    en: "Real viscous pipe flow",
    icon: "🛢️",
    scene: "viscous",
    base: all(true, true, false, true),
    speedSensitive: false,
    explainTh:
      "ท่อจริงมีความหนืด (viscous) เกิดแรงเสียดทานที่ผนัง ของไหลจึงไหลช้าลงใกล้ผนังและสูญเสียพลังงาน (head loss) สมมติฐาน 'ไม่มีความหนืด' จึงถูกละเมิด ใช้เบอร์นูลลีได้แค่แบบประมาณ ต้องบวกพจน์การสูญเสีย h_L เพิ่มในสมการพลังงาน",
  },
  {
    id: "gas",
    th: "ก๊าซความเร็วสูง",
    en: "High-speed compressible gas",
    icon: "💨",
    scene: "compressible",
    base: all(true, true, true, true),
    speedSensitive: true,
    explainTh:
      "ก๊าซที่ความเร็วสูง (Mach สูง) ความหนาแน่น ρ เปลี่ยนตามความดันอย่างมาก สมมติฐาน 'อัดตัวไม่ได้' จึงถูกละเมิด เกณฑ์ทั่วไปคือถ้า Mach > 0.3 ผลของการอัดตัวเริ่มมีนัยสำคัญ และเมื่อ Mach เข้าใกล้ 1 สมการเบอร์นูลลีแบบมาตรฐานใช้ไม่ได้เลย ต้องใช้สมการพลังงานแบบ compressible แทน",
  },
  {
    id: "turbulent",
    th: "การไหลปั่นป่วน",
    en: "Turbulent flow",
    icon: "🌀",
    scene: "turbulent",
    base: all(false, true, false, false),
    speedSensitive: false,
    explainTh:
      "การไหลปั่นป่วนมีการหมุนวน (eddies) สลับไปมา ความเร็วในแต่ละจุดแกว่งตามเวลา (ไม่คงตัว) มีแรงเสียดทานภายในจากความปั่นป่วน และเส้นการไหลพันกันจนคิดตามแนว streamline เดียวไม่ได้ ละเมิดหลายข้อพร้อมกัน ใช้เบอร์นูลลีได้เพียงค่าเฉลี่ยแบบประมาณหยาบ ๆ เท่านั้น",
  },
  {
    id: "unsteady",
    th: "การไหลไม่คงตัว",
    en: "Unsteady flow",
    icon: "⏱️",
    scene: "unsteady",
    base: all(false, true, true, true),
    speedSensitive: false,
    explainTh:
      "การไหลไม่คงตัว (unsteady) สนามความเร็วเปลี่ยนตามเวลา เช่นวาล์วเพิ่งเปิด/ปิด หรือการไหลแบบเต้นเป็นจังหวะ สมมติฐาน 'คงตัว' ถูกละเมิด สมการเบอร์นูลลีรูปมาตรฐานใช้ไม่ได้ ต้องใช้รูปไม่คงตัวที่มีพจน์ ∂/∂t (unsteady Bernoulli) แทน",
  },
];

/** Mach threshold above which compressibility becomes significant. */
export const MACH_COMPRESSIBLE_WARN = 0.3;
/** Mach threshold above which the incompressible assumption fully fails. */
export const MACH_COMPRESSIBLE_FAIL = 0.7;

/** Look up a scenario by id, falling back to the first one. */
export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/**
 * Resolve the live assumption set for a scenario at a given Mach-ish speed.
 * Only the gas (speed-sensitive) scenario changes with speed: its
 * `incompressible` flag flips off once Mach exceeds the warning threshold.
 */
export function resolveAssumptions(scenario: Scenario, mach: number): AssumptionSet {
  const a: AssumptionSet = { ...scenario.base };
  if (scenario.speedSensitive) {
    a.incompressible = mach < MACH_COMPRESSIBLE_WARN;
  }
  return a;
}

/** Count how many of the four assumptions are satisfied. */
export function satisfiedCount(a: AssumptionSet): number {
  return ASSUMPTION_ORDER.reduce((n, k) => n + (a[k] ? 1 : 0), 0);
}

/**
 * The first violated assumption in canonical order (the "key" failure to
 * highlight in the result grid), or null when everything holds.
 */
export function keyViolation(a: AssumptionSet): AssumptionKey | null {
  return ASSUMPTION_ORDER.find((k) => !a[k]) ?? null;
}

/**
 * Overall verdict from an assumption set, with extra severity for the gas case:
 *  - all four satisfied                       → valid
 *  - exactly one violated                     → approximate
 *  - gas above the hard Mach threshold        → invalid (strong compressibility)
 *  - two or more violated                     → invalid
 */
export function verdict(scenario: Scenario, mach: number): Validity {
  const a = resolveAssumptions(scenario, mach);
  const missing = 4 - satisfiedCount(a);
  // High-speed gas past the failure threshold is unambiguously invalid even
  // though only one assumption (incompressible) is nominally violated.
  if (scenario.speedSensitive && mach >= MACH_COMPRESSIBLE_FAIL) return "invalid";
  if (missing === 0) return "valid";
  if (missing === 1) return "approximate";
  return "invalid";
}

/** Map a verdict to a numeric index used by Challenge predicates (0/1/2). */
export const VALIDITY_INDEX: Record<Validity, number> = {
  valid: 0,
  approximate: 1,
  invalid: 2,
};

/** The numeric result object Challenge predicates run against. */
export interface ValidityResult {
  /** 0 = valid, 1 = approximate, 2 = invalid. */
  validityIndex: number;
  /** Index of the active scenario in SCENARIOS (numeric sentinel). */
  scenario: number;
  /** Current Mach-ish speed. */
  mach: number;
  /** Number of assumptions satisfied (0–4). */
  satisfied: number;
}

/** Build the live numeric result object for the current selection. */
export function buildResult(
  scenarioIndex: number,
  mach: number,
): ValidityResult {
  const scenario = SCENARIOS[clamp(scenarioIndex, 0, SCENARIOS.length - 1)];
  const a = resolveAssumptions(scenario, mach);
  return {
    validityIndex: VALIDITY_INDEX[verdict(scenario, mach)],
    scenario: scenarioIndex,
    mach,
    satisfied: satisfiedCount(a),
  };
}

/** Index of the high-speed gas scenario (used by guided steps / challenges). */
export const GAS_SCENARIO_INDEX = SCENARIOS.findIndex((s) => s.id === "gas");
