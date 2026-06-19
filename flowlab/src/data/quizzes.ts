import type { QuizQuestion } from "../types";

/**
 * Quiz bank. Questions are tagged by lessonId so the quiz page can filter to a
 * single chapter or run a mixed exam across all of them.
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  /* ---- Fluid properties ---- */
  {
    id: "fp-1",
    lessonId: "fluid-properties",
    type: "mcq",
    prompt: "ความหนาแน่น (Density) มีหน่วย SI เป็นอะไร?",
    options: ["kg/m³", "N/m³", "Pa", "m³/kg"],
    answerIndex: 0,
    explanation:
      "ความหนาแน่น ρ = m/V จึงมีหน่วย kg/m³ ส่วน N/m³ คือน้ำหนักจำเพาะ (specific weight)",
  },
  {
    id: "fp-2",
    lessonId: "fluid-properties",
    type: "numeric",
    prompt: "น้ำมวล 5 kg มีปริมาตร 0.005 m³ ความหนาแน่นเท่ากับเท่าใด (kg/m³)?",
    answer: 1000,
    unit: "kg/m³",
    tolerance: 1,
    hint: "ρ = m / V",
    explanation: "ρ = 5 / 0.005 = 1000 kg/m³ ซึ่งเป็นความหนาแน่นมาตรฐานของน้ำ",
  },

  /* ---- Hydrostatic pressure ---- */
  {
    id: "hp-1",
    lessonId: "hydrostatic-pressure",
    type: "mcq",
    prompt:
      "ถ้าความลึกในน้ำเพิ่มขึ้น 2 เท่า ความดัน hydrostatic (P = ρgh) จะเป็นอย่างไร?",
    options: ["เพิ่มขึ้น 2 เท่า", "เพิ่มขึ้น 4 เท่า", "เท่าเดิม", "ลดลงครึ่งหนึ่ง"],
    answerIndex: 0,
    explanation:
      "P = ρgh เป็นสัดส่วนเชิงเส้นกับ h เมื่อ h เพิ่ม 2 เท่า P ก็เพิ่ม 2 เท่า (ไม่ใช่กำลังสอง)",
  },
  {
    id: "hp-2",
    lessonId: "hydrostatic-pressure",
    type: "numeric",
    prompt:
      "ความดันเกจที่ความลึก 5 m ในน้ำ (ρ=1000, g=9.81) เท่ากับกี่ kPa? (ตอบเป็น kPa)",
    answer: 49.05,
    unit: "kPa",
    tolerance: 0.5,
    hint: "P = ρgh แล้วหารด้วย 1000 เพื่อเป็น kPa",
    explanation: "P = 1000 × 9.81 × 5 = 49,050 Pa = 49.05 kPa",
  },
  {
    id: "hp-3",
    lessonId: "hydrostatic-pressure",
    type: "boolean",
    prompt: "ความดัน hydrostatic ขึ้นกับรูปร่างของภาชนะ",
    answer: false,
    explanation:
      "ไม่จริง — ความดันขึ้นกับความลึก h เท่านั้น (สำหรับของไหลเดียวกัน) ไม่ขึ้นกับรูปร่างภาชนะ นี่คือ 'hydrostatic paradox'",
  },

  /* ---- Buoyancy ---- */
  {
    id: "bu-1",
    lessonId: "buoyancy",
    type: "mcq",
    prompt: "วัตถุจะลอยน้ำได้เมื่อใด?",
    options: [
      "ความหนาแน่นเฉลี่ยของวัตถุน้อยกว่าของไหล",
      "วัตถุมีน้ำหนักมาก",
      "วัตถุทำจากโลหะ",
      "ปริมาตรวัตถุเล็ก",
    ],
    answerIndex: 0,
    explanation:
      "วัตถุลอยเมื่อ ρ_วัตถุ < ρ_ของไหล เรือเหล็กลอยได้เพราะรูปทรงกลวงทำให้ความหนาแน่นเฉลี่ย (รวมอากาศข้างใน) น้อยกว่าน้ำ",
  },
  {
    id: "bu-2",
    lessonId: "buoyancy",
    type: "boolean",
    prompt: "แรงลอยตัวเท่ากับน้ำหนักของของไหลที่ถูกแทนที่",
    answer: true,
    explanation: "นี่คือหลักการของอาร์คิมิดีส: F_b = น้ำหนักของของไหลที่ถูกแทนที่ = ρ_fluid·g·V_displaced",
  },

  /* ---- Continuity ---- */
  {
    id: "co-1",
    lessonId: "continuity",
    type: "mcq",
    prompt:
      "ในท่อที่หน้าตัดเล็กลง ความเร็วของของไหลจะเปลี่ยนอย่างไร ถ้า flow rate คงที่?",
    options: ["เพิ่มขึ้น", "ลดลง", "เท่าเดิม", "เป็นศูนย์"],
    answerIndex: 0,
    explanation:
      "จาก A₁V₁ = A₂V₂ เมื่อ A ลด V ต้องเพิ่มเพื่อให้ Q คงที่ — นี่คือเหตุผลที่บีบปลายสายยางแล้วน้ำพุ่งแรงขึ้น",
  },
  {
    id: "co-2",
    lessonId: "continuity",
    type: "numeric",
    prompt:
      "A₁ = 0.02 m², V₁ = 3 m/s ไหลเข้าท่อที่ A₂ = 0.01 m² ความเร็ว V₂ เป็นกี่ m/s?",
    answer: 6,
    unit: "m/s",
    tolerance: 0.1,
    hint: "V₂ = A₁V₁ / A₂",
    explanation: "V₂ = (0.02 × 3) / 0.01 = 6 m/s (พื้นที่ลดครึ่ง ความเร็วเพิ่มเท่าตัว)",
  },

  /* ---- Bernoulli ---- */
  {
    id: "be-1",
    lessonId: "bernoulli",
    type: "mcq",
    prompt: "ใน Venturi tube เมื่อความเร็วเพิ่ม ความดันโดยทั่วไปจะเป็นอย่างไร?",
    options: ["ลดลง", "เพิ่มขึ้น", "เท่าเดิม", "เป็นศูนย์"],
    answerIndex: 0,
    explanation:
      "ตามเบอร์นูลลี เมื่อ velocity head เพิ่ม pressure head ต้องลด (พลังงานรวมคงที่) ความดันในคอคอดจึงลดลง",
  },
  {
    id: "be-2",
    lessonId: "bernoulli",
    type: "boolean",
    prompt: "สมการเบอร์นูลลีใช้ได้กับทุกการไหล รวมถึงที่มีแรงเสียดทานสูง",
    answer: false,
    explanation:
      "ไม่จริง — เบอร์นูลลีสมมติว่าไม่มีแรงหนืด (inviscid) ไม่มีการสูญเสียพลังงาน ในของจริงที่มีแรงเสียดทานต้องเพิ่มเทอม head loss",
  },

  /* ---- Reynolds ---- */
  {
    id: "re-1",
    lessonId: "reynolds",
    type: "mcq",
    prompt: "Reynolds number สูงมากมักหมายถึงการไหลแบบใด?",
    options: ["Turbulent (ปั่นป่วน)", "Laminar (ราบเรียบ)", "หยุดนิ่ง", "ไม่เกี่ยวกัน"],
    answerIndex: 0,
    explanation:
      "Re สูง = แรงเฉื่อยเด่นกว่าแรงหนืด → การไหลปั่นป่วน (turbulent) สำหรับท่อกลม Re > 4000 ถือว่า turbulent",
  },
  {
    id: "re-2",
    lessonId: "reynolds",
    type: "mcq",
    prompt: "Reynolds number คืออัตราส่วนของอะไร?",
    options: [
      "แรงเฉื่อย ต่อ แรงหนืด",
      "ความดัน ต่อ ความเร็ว",
      "แรงโน้มถ่วง ต่อ แรงลอยตัว",
      "พลังงาน ต่อ เวลา",
    ],
    answerIndex: 0,
    explanation:
      "Re = แรงเฉื่อย (inertial) / แรงหนืด (viscous) เมื่อแรงเฉื่อยชนะ การไหลจะปั่นป่วน",
  },

  /* ---- Pipe loss ---- */
  {
    id: "pl-1",
    lessonId: "pipe-loss",
    type: "mcq",
    prompt:
      "ถ้าความเร็วในท่อเพิ่มขึ้น 2 เท่า การสูญเสียเฮด (head loss) จะเปลี่ยนอย่างไร?",
    options: ["เพิ่ม 4 เท่า", "เพิ่ม 2 เท่า", "เท่าเดิม", "ลดลง"],
    answerIndex: 0,
    explanation:
      "head loss ∝ V² (ทั้ง major และ minor) เมื่อ V เพิ่ม 2 เท่า head loss เพิ่ม 2² = 4 เท่า",
  },
  {
    id: "pl-2",
    lessonId: "pipe-loss",
    type: "boolean",
    prompt: "ท่อที่ยาวขึ้นทำให้ major head loss มากขึ้น",
    answer: true,
    explanation: "h_f = f(L/D)(V²/2g) แปรผันตรงกับความยาว L ท่อยิ่งยาวยิ่งเสียพลังงานมาก",
  },

  /* ---- Momentum ---- */
  {
    id: "mo-1",
    lessonId: "momentum",
    type: "mcq",
    prompt: "แรงที่ของไหลกระทำต่อใบพัด/แผ่นกั้น มาจากการเปลี่ยนแปลงของปริมาณใด?",
    options: ["โมเมนตัม (Momentum)", "อุณหภูมิ", "ความหนาแน่น", "ความหนืด"],
    answerIndex: 0,
    explanation:
      "ตามสมการโมเมนตัม F = ṁ(V_out − V_in) แรงเกิดจากอัตราการเปลี่ยนโมเมนตัมของของไหล",
  },
];

export function questionsForLesson(lessonId: string): QuizQuestion[] {
  return QUIZ_QUESTIONS.filter((q) => q.lessonId === lessonId);
}
