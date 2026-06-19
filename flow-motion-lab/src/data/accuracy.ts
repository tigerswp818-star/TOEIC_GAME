/**
 * Engineering accuracy classification for every simulation (requirement: each
 * sim must clearly state what kind of model it is). Four kinds, each with a
 * Thai+English label and a default explanatory note. Per-sim overrides add a
 * specific caveat where useful.
 */

export type AccuracyKind = "conceptual" | "simplified" | "calculator" | "approximation";

export interface AccuracyMeta {
  label: string;
  icon: string;
  /** Default note used when a sim has no specific override. */
  note: string;
  /** Tailwind tone classes for the badge. */
  tone: string;
}

export const ACCURACY_KINDS: Record<AccuracyKind, AccuracyMeta> = {
  conceptual: {
    label: "ภาพเชิงแนวคิด Conceptual visualization",
    icon: "🎨",
    note: "การจำลองนี้เน้นให้ 'เห็นพฤติกรรมเชิงคุณภาพ' ของของไหลเพื่อการเรียนรู้ ไม่ใช่ผลลัพธ์ CFD ที่แม่นยำเชิงตัวเลข",
    tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
  },
  calculator: {
    label: "เครื่องคำนวณจากสูตร Formula-based",
    icon: "🧮",
    note: "ค่าตัวเลขคำนวณจากสูตรมาตรฐานโดยตรง (ถูกต้องตามสูตร) ส่วนภาพเคลื่อนไหวเป็นภาพประกอบเชิงสัดส่วน",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  simplified: {
    label: "แบบจำลองอย่างง่าย Simplified model",
    icon: "🔧",
    note: "แบบจำลองเชิงวิศวกรรมอย่างง่ายเพื่อการเรียนรู้ ใช้สมมติฐานที่ทำให้เข้าใจง่ายขึ้น",
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  approximation: {
    label: "การประมาณขั้นสูง Advanced approximation",
    icon: "📐",
    note: "ใช้สูตรประมาณ (approximation) ที่ยอมรับในงานวิศวกรรม ให้ผลใกล้เคียงค่าจริงในช่วงที่กำหนด",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  },
};

/** Per-sim accuracy kind. Anything not listed defaults to "simplified". */
const SIM_ACCURACY: Record<string, AccuracyKind> = {
  // Formula-based calculators — displayed numbers come straight from standard formulas.
  continuity: "calculator",
  bernoulli: "calculator",
  hydrostatic: "calculator",
  manometer: "calculator",
  "dam-pressure": "calculator",
  buoyancy: "calculator",
  "floating-stability": "calculator",
  pascal: "calculator",
  "jet-impact": "calculator",
  "pipe-bend": "calculator",
  nozzle: "calculator",
  headloss: "calculator",
  "pump-curve": "calculator",
  affinity: "calculator",
  npsh: "calculator",
  "control-volume": "calculator",
  "pipe-junction": "calculator",
  "egl-hgl": "calculator",
  "pipe-network": "calculator",
  reynolds: "calculator",
  "open-channel": "calculator",
  "hydraulic-jump": "calculator",
  froude: "calculator",
  weir: "calculator",
  "laminar-profile": "calculator",
  "flow-meter": "calculator",
  "dimension-checker": "calculator",
  similarity: "calculator",
  capillary: "calculator",
  "viscosity-race": "calculator",
  // Advanced approximations.
  moody: "approximation",
  "turbulent-profile": "approximation",
  "boundary-layer": "approximation",
  mach: "approximation",
  "cd-nozzle": "approximation",
  // Conceptual / qualitative visualizations.
  "flow-around": "conceptual",
  "flow-separation": "conceptual",
  airfoil: "conceptual",
  "cfd-mesh": "conceptual",
  "bernoulli-validity": "conceptual",
  streamlines: "conceptual",
  rotational: "conceptual",
  "velocity-field": "conceptual",
  vortex: "conceptual",
  "forced-free-vortex": "conceptual",
  circulation: "conceptual",
  dimensionless: "conceptual",
  "non-newtonian": "conceptual",
};

/** Optional per-sim caveat appended to the kind's default note. */
const SIM_NOTE_OVERRIDE: Record<string, string> = {
  "flow-around": "ใช้ทฤษฎี potential flow รอบทรงกระบอก (ไม่มีความหนืด) — streamline และ wake เป็นภาพประกอบเชิงแนวคิด",
  airfoil: "เป็นภาพแนวคิดของแรงยก ไม่ใช่การคำนวณ CFD จริง — C_L ใช้ทฤษฎี thin-airfoil อย่างง่ายพร้อมแบบจำลอง stall",
  "cd-nozzle": "เป็นแบบจำลองเชิงการศึกษาอย่างง่ายของการไหลอัดตัวได้ ไม่ใช่ตาราง isentropic ที่แม่นยำ",
  "cfd-mesh": "สาธิตแนวคิด mesh ของ CFD — CFD จริงต้องแก้สมการเชิงตัวเลขพร้อม boundary condition ที่เหมาะสม",
  moody: "f คำนวณด้วยสูตร Swamee–Jain (ประมาณค่าของ Colebrook) คลาดเคลื่อนเล็กน้อยในบางช่วง",
  "turbulent-profile": "ใช้กฎกำลัง 1/7 (power-law) ซึ่งเป็นการประมาณหน้าตัดความเร็ว turbulent",
  "flow-separation": "จุดแยกตัวและการสะบัดวนแสดงเชิงคุณภาพตาม Reynolds number ไม่ใช่ค่าที่คำนวณแม่นยำ",
};

export function accuracyOf(simId: string): { kind: AccuracyKind; meta: AccuracyMeta; note: string } {
  const kind = SIM_ACCURACY[simId] ?? "simplified";
  const meta = ACCURACY_KINDS[kind];
  const override = SIM_NOTE_OVERRIDE[simId];
  return { kind, meta, note: override ? `${meta.note} · ${override}` : meta.note };
}
