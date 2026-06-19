import type { Lesson } from "../types";

/**
 * The learning map. Adding a new chapter is intentionally a one-object change:
 * append here and (if it needs a custom page) add a matching entry in the route
 * table in App.tsx. Lesson pages are otherwise generated from `lessonContent`.
 */
export const LESSONS: Lesson[] = [
  {
    id: "fluid-properties",
    order: 1,
    title: "พื้นฐานของของไหล",
    titleEn: "Fluid Properties",
    summary: "ความหนาแน่น น้ำหนักจำเพาะ และความหนืด คืออะไร",
    icon: "💧",
    accent: "from-aqua-400 to-brand-500",
    path: "/lesson/fluid-properties",
  },
  {
    id: "hydrostatic-pressure",
    order: 2,
    title: "ความดันในของไหล",
    titleEn: "Hydrostatic Pressure",
    summary: "ยิ่งลึก ความดันยิ่งสูง — ทดลองกับถังน้ำเสมือนจริง",
    icon: "🌊",
    accent: "from-brand-400 to-brand-600",
    path: "/lesson/hydrostatic-pressure",
  },
  {
    id: "buoyancy",
    order: 3,
    title: "แรงลอยตัว",
    titleEn: "Buoyancy",
    summary: "ทำไมเรือเหล็กถึงลอย — หลักการของอาร์คิมิดีส",
    icon: "🛟",
    accent: "from-aqua-400 to-aqua-600",
    path: "/lesson/buoyancy",
  },
  {
    id: "continuity",
    order: 4,
    title: "สมการความต่อเนื่อง",
    titleEn: "Continuity Equation",
    summary: "ท่อแคบลง ของไหลไหลเร็วขึ้น — A₁V₁ = A₂V₂",
    icon: "🔁",
    accent: "from-brand-400 to-aqua-500",
    path: "/lesson/continuity",
  },
  {
    id: "bernoulli",
    order: 5,
    title: "สมการเบอร์นูลลี",
    titleEn: "Bernoulli Equation",
    summary: "พลังงานเปลี่ยนรูประหว่างความดัน ความเร็ว และความสูง",
    icon: "✈️",
    accent: "from-brand-500 to-violet-500",
    path: "/lesson/bernoulli",
  },
  {
    id: "reynolds",
    order: 6,
    title: "Reynolds Number และรูปแบบการไหล",
    titleEn: "Reynolds Number",
    summary: "Laminar หรือ Turbulent? ดูได้จากอัตราส่วนแรงเฉื่อยต่อแรงหนืด",
    icon: "🌀",
    accent: "from-violet-400 to-brand-500",
    path: "/lesson/reynolds",
  },
  {
    id: "pipe-loss",
    order: 7,
    title: "การสูญเสียพลังงานในท่อ",
    titleEn: "Pipe Loss",
    summary: "ท่อยาว ท่อเล็ก น้ำเร็ว — ทำไมจึงเสียพลังงานมากขึ้น",
    icon: "🔧",
    accent: "from-amber-400 to-brand-500",
    path: "/lesson/pipe-loss",
  },
  {
    id: "momentum",
    order: 8,
    title: "Momentum Equation เบื้องต้น",
    titleEn: "Momentum Equation",
    summary: "แรงจากของไหลที่เปลี่ยนทิศ — พื้นฐานของแรงดันน้ำ",
    icon: "➡️",
    accent: "from-rose-400 to-brand-500",
    path: "/lesson/momentum",
  },
  {
    id: "formula-sheet",
    order: null,
    title: "Formula Sheet",
    titleEn: "Formula Sheet",
    summary: "รวมสูตรสำคัญพร้อมตัวแปร หน่วย และข้อควรระวัง",
    icon: "📋",
    accent: "from-slate-400 to-slate-600",
    path: "/formulas",
  },
  {
    id: "unit-converter",
    order: null,
    title: "Unit Converter",
    titleEn: "Unit Converter",
    summary: "แปลงหน่วยความดัน ความยาว อัตราการไหล และอื่น ๆ",
    icon: "🔢",
    accent: "from-slate-400 to-slate-600",
    path: "/converter",
  },
];

/** Only the numbered chapters count toward learning progress. */
export const CORE_LESSONS = LESSONS.filter((l) => l.order !== null);

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
