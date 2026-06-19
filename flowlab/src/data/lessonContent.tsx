import type { ComponentType, ReactNode } from "react";
import { Term } from "../components/lesson/Term";
import { FluidPropertiesSim } from "../components/simulators/FluidPropertiesSim";
import { HydrostaticPressureSim } from "../components/simulators/HydrostaticPressureSim";
import { BuoyancySim } from "../components/simulators/BuoyancySim";
import { ContinuitySim } from "../components/simulators/ContinuitySim";
import { BernoulliSim } from "../components/simulators/BernoulliSim";
import { ReynoldsSim } from "../components/simulators/ReynoldsSim";
import { PipeLossSim } from "../components/simulators/PipeLossSim";
import { MomentumSim } from "../components/simulators/MomentumSim";

export interface LessonContent {
  /** Concept summary — plain-language explanation with key English terms. */
  concept: ReactNode;
  /** The interactive simulator for this chapter. */
  simulator?: ComponentType;
  /** Heading for the simulator card. */
  simulatorTitle?: string;
  /** A fully worked numeric example. */
  workedExample: { title: string; body: ReactNode };
  /** 2–4 short, memorable takeaways. */
  keyTakeaways: string[];
  /** Formula-sheet ids relevant to this lesson (for cross-linking). */
  relatedFormulaIds: string[];
  /** Optional assumptions block. */
  assumptions?: ReactNode;
}

/**
 * Per-chapter teaching content. Keeping this data-driven means a new chapter is
 * just a new key here plus an entry in lessons.ts.
 */
export const LESSON_CONTENT: Record<string, LessonContent> = {
  "fluid-properties": {
    concept: (
      <>
        <p>
          ของไหล (fluid) คือสารที่ไหลได้ ได้แก่ ของเหลวและแก๊ส คุณสมบัติพื้นฐาน
          ที่ต้องรู้ก่อนคือ{" "}
          <Term termEn="Density">ความหนาแน่น (Density, ρ)</Term> คือมวลต่อปริมาตร,{" "}
          น้ำหนักจำเพาะ (Specific weight, γ = ρg) คือน้ำหนักต่อปริมาตร และ{" "}
          <Term termEn="Viscosity">ความหนืด (Viscosity, μ)</Term>{" "}
          คือความต้านทานการไหล
        </p>
        <p className="mt-2">
          ความหนาแน่นของน้ำ ≈ 1000 kg/m³ ใช้เป็นค่าอ้างอิงบ่อย ๆ ส่วน
          ความถ่วงจำเพาะ (specific gravity) คืออัตราส่วนความหนาแน่นเทียบกับน้ำ
          ถ้าน้อยกว่า 1 มีแนวโน้มลอย ถ้ามากกว่า 1 มีแนวโน้มจม
        </p>
      </>
    ),
    simulator: FluidPropertiesSim,
    simulatorTitle: "ทดลอง: คำนวณความหนาแน่นและน้ำหนักจำเพาะ",
    workedExample: {
      title: "หาความหนาแน่นของน้ำมัน",
      body: (
        <>
          <p>น้ำมันมวล 0.85 kg มีปริมาตร 0.001 m³ ความหนาแน่นเท่าใด?</p>
          <p className="mt-1 font-mono">ρ = m / V = 0.85 / 0.001 = 850 kg/m³</p>
          <p className="mt-1">
            γ = ρg = 850 × 9.81 = 8,338.5 N/m³ และ SG = 850/1000 = 0.85 (เบากว่าน้ำ → ลอยบนน้ำ)
          </p>
        </>
      ),
    },
    keyTakeaways: [
      "ความหนาแน่น ρ = m/V หน่วย kg/m³",
      "น้ำหนักจำเพาะ γ = ρg หน่วย N/m³ (อย่าสับสนกัน)",
      "น้ำมีความหนาแน่น ≈ 1000 kg/m³ ใช้เป็นตัวเทียบ",
    ],
    relatedFormulaIds: ["density", "specific-weight"],
  },

  "hydrostatic-pressure": {
    concept: (
      <>
        <p>
          <Term termEn="Pressure">ความดัน (Pressure, P)</Term> คือแรงตั้งฉากต่อ
          หนึ่งหน่วยพื้นที่ (P = F/A) ในของไหลที่อยู่นิ่ง ความดันจะเพิ่มขึ้นตาม
          ความลึกตามสมการ <strong>P = ρgh</strong>
        </p>
        <p className="mt-2">
          ยิ่งลึก น้ำด้านบนกดทับมากขึ้น ความดันจึงสูงขึ้นแบบเชิงเส้น สิ่งที่น่าสนใจคือ
          ความดันขึ้นกับ <em>ความลึก</em> เท่านั้น ไม่ขึ้นกับรูปร่างหรือปริมาณน้ำใน
          ภาชนะ (เรียกว่า hydrostatic paradox)
        </p>
        <p className="mt-2">
          ค่าที่ได้จาก ρgh คือ <strong>ความดันเกจ (gauge)</strong> ถ้าต้องการ
          ความดันสัมบูรณ์ (absolute) ให้บวกความดันบรรยากาศ ≈ 101.3 kPa
        </p>
      </>
    ),
    simulator: HydrostaticPressureSim,
    simulatorTitle: "ทดลอง: Hydrostatic Pressure Simulator",
    workedExample: {
      title: "ความดันที่ก้นสระลึก 3 m",
      body: (
        <>
          <p>สระว่ายน้ำลึก 3 m ความดันเกจที่ก้นสระเท่าใด? (ρ=1000, g=9.81)</p>
          <p className="mt-1 font-mono">P = ρgh = 1000 × 9.81 × 3 = 29,430 Pa ≈ 29.4 kPa</p>
          <p className="mt-1">ความดันสัมบูรณ์ = 29.4 + 101.3 = 130.7 kPa</p>
        </>
      ),
    },
    keyTakeaways: [
      "P = ρgh — ความดันแปรผันตรงกับความลึก",
      "ความดันไม่ขึ้นกับรูปร่างภาชนะ",
      "ρgh ให้ความดันเกจ บวก P_atm เพื่อได้ความดันสัมบูรณ์",
    ],
    relatedFormulaIds: ["pressure", "hydrostatic"],
    assumptions: <>ของไหลอยู่นิ่ง (static), อัดตัวไม่ได้ และความหนาแน่นคงที่ตลอดความลึก</>,
  },

  buoyancy: {
    concept: (
      <>
        <p>
          เมื่อวัตถุจมในของไหล ของไหลจะดัน <Term termEn="Buoyant force">แรงลอยตัว
          (Buoyant force)</Term> ขึ้นเท่ากับ <strong>น้ำหนักของของไหลที่ถูกแทนที่</strong>{" "}
          (หลักการของอาร์คิมิดีส): F_b = ρ_fluid · g · V_displaced
        </p>
        <p className="mt-2">
          เปรียบเทียบความหนาแน่นเฉลี่ยของวัตถุกับของไหล:
        </p>
        <ul className="ml-4 mt-1 list-disc space-y-1">
          <li>ρ_วัตถุ &lt; ρ_ของไหล → ลอย (จมบางส่วน)</li>
          <li>ρ_วัตถุ &gt; ρ_ของไหล → จม</li>
          <li>ρ_วัตถุ = ρ_ของไหล → ลอยนิ่งกลางน้ำ (neutral)</li>
        </ul>
        <p className="mt-2">
          เรือเหล็กลอยได้เพราะรูปทรงกลวงทำให้ความหนาแน่น <em>เฉลี่ย</em> ทั้งลำ
          (เหล็ก + อากาศ) น้อยกว่าน้ำ
        </p>
      </>
    ),
    simulator: BuoyancySim,
    simulatorTitle: "ทดลอง: Buoyancy Simulator",
    workedExample: {
      title: "ก้อนน้ำแข็งลอยน้ำ",
      body: (
        <>
          <p>น้ำแข็ง (ρ=917) ลอยในน้ำทะเล (ρ=1025) จมกี่ % ?</p>
          <p className="mt-1 font-mono">สัดส่วนที่จม = ρ_วัตถุ / ρ_ของไหล = 917 / 1025 ≈ 0.895</p>
          <p className="mt-1">จึงจมประมาณ 89.5% โผล่พ้นน้ำราว 10% — เป็นที่มาของคำว่า "ยอดภูเขาน้ำแข็ง"</p>
        </>
      ),
    },
    keyTakeaways: [
      "F_b = ρ_fluid · g · V_displaced (อาร์คิมิดีส)",
      "ลอยเมื่อ ρ_วัตถุ < ρ_ของไหล",
      "สัดส่วนที่จมของวัตถุลอย = ρ_วัตถุ / ρ_ของไหล",
    ],
    relatedFormulaIds: ["buoyancy"],
    assumptions: <>ของไหลอยู่นิ่ง และวัตถุอยู่ในสมดุล (ไม่มีความเร่ง)</>,
  },

  continuity: {
    concept: (
      <>
        <p>
          <Term termEn="Flow rate">อัตราการไหล (Flow rate, Q)</Term> = พื้นที่หน้าตัด ×
          ความเร็ว (Q = A·V) สำหรับของไหลอัดตัวไม่ได้และการไหลคงตัว มวลที่เข้าต้อง
          เท่ากับมวลที่ออก จึงได้ <strong>A₁V₁ = A₂V₂</strong>
        </p>
        <p className="mt-2">
          ผลที่ตามมา: เมื่อท่อแคบลง (A ลด) ความเร็วต้องเพิ่มขึ้นเพื่อให้ Q คงที่ —
          นี่คือเหตุผลที่บีบปลายสายยางแล้วน้ำพุ่งแรงขึ้น
        </p>
      </>
    ),
    simulator: ContinuitySim,
    simulatorTitle: "ทดลอง: Continuity Equation Simulator",
    workedExample: {
      title: "ท่อลดขนาด",
      body: (
        <>
          <p>น้ำไหลใน A₁ = 0.10 m² ด้วย V₁ = 1.5 m/s เข้าสู่ท่อ A₂ = 0.04 m². V₂?</p>
          <p className="mt-1 font-mono">Q = A₁V₁ = 0.10 × 1.5 = 0.15 m³/s</p>
          <p className="mt-1 font-mono">V₂ = Q / A₂ = 0.15 / 0.04 = 3.75 m/s</p>
        </>
      ),
    },
    keyTakeaways: [
      "Q = A·V หน่วย m³/s",
      "A₁V₁ = A₂V₂ สำหรับ incompressible + steady flow",
      "ท่อแคบลง → ความเร็วเพิ่มขึ้น",
    ],
    relatedFormulaIds: ["flow-rate", "continuity"],
    assumptions: <>ของไหลอัดตัวไม่ได้ (incompressible) และการไหลคงตัว (steady)</>,
  },

  bernoulli: {
    concept: (
      <>
        <p>
          สมการเบอร์นูลลีคืออนุรักษ์พลังงานของของไหลตามเส้น{" "}
          <Term termEn="Streamline">เส้นกระแส (streamline)</Term> เขียนในรูป "เฮด"
          (พลังงานต่อหน่วยน้ำหนัก หน่วยเป็นเมตร):
        </p>
        <p className="mt-2 font-mono text-center">
          P/(ρg) + V²/(2g) + z = ค่าคงที่
        </p>
        <p className="mt-2">
          ประกอบด้วย pressure head, velocity head และ elevation head พลังงานรวม
          ค่อนข้างคงที่แต่ <strong>เปลี่ยนรูปไปมา</strong> เช่น ใน Venturi เมื่อท่อแคบ
          ความเร็วเพิ่ม (velocity head ↑) ความดันจึงลด (pressure head ↓)
        </p>
      </>
    ),
    simulator: BernoulliSim,
    simulatorTitle: "ทดลอง: Bernoulli & Venturi Simulator",
    workedExample: {
      title: "ความเร็วน้ำพุ่งจากรู (Torricelli)",
      body: (
        <>
          <p>ถังเปิดมีรูที่ก้น ระดับน้ำสูงเหนือรู h = 2 m น้ำพุ่งออกเร็วเท่าใด?</p>
          <p className="mt-1">
            ที่ผิวบน: P=0(เกจ), V≈0, z=2 ; ที่รู: P=0, z=0 → V²/(2g) = 2
          </p>
          <p className="mt-1 font-mono">V = √(2gh) = √(2 × 9.81 × 2) ≈ 6.26 m/s</p>
        </>
      ),
    },
    keyTakeaways: [
      "P/(ρg) + V²/(2g) + z = ค่าคงที่ (ทุกเทอมหน่วยเมตร)",
      "พลังงานเปลี่ยนรูประหว่างความดัน-ความเร็ว-ความสูง",
      "เร็วขึ้น → ความดันลดลง (Venturi effect)",
    ],
    relatedFormulaIds: ["bernoulli"],
    assumptions: (
      <>
        ใช้ได้เฉพาะ <strong>steady, incompressible, inviscid</strong> (ไม่มีแรงหนืด)
        ตามเส้น streamline เดียวกัน และไม่มีปั๊ม/กังหัน — ในของจริงที่มีแรงเสียดทาน
        ต้องเพิ่มเทอม head loss อย่าใช้เบอร์นูลลีกับทุกกรณีโดยไม่ตรวจสมมติฐาน
      </>
    ),
  },

  reynolds: {
    concept: (
      <>
        <p>
          <strong>Reynolds number (Re)</strong> คือเลขไม่มีหน่วยที่บอกว่า{" "}
          แรงเฉื่อย (inertial) หรือแรงหนืด (viscous) เป็นใหญ่: Re = ρVD/μ
        </p>
        <p className="mt-2">สำหรับการไหลในท่อกลม:</p>
        <ul className="ml-4 mt-1 list-disc space-y-1">
          <li><Term termEn="Laminar flow">Laminar</Term> ถ้า Re &lt; 2300 (เรียบ เป็นชั้น)</li>
          <li>Transitional ถ้า 2300 ≤ Re ≤ 4000 (เริ่มแกว่ง)</li>
          <li><Term termEn="Turbulence">Turbulent</Term> ถ้า Re &gt; 4000 (ปั่นป่วน มี eddies)</li>
        </ul>
      </>
    ),
    simulator: ReynoldsSim,
    simulatorTitle: "ทดลอง: Reynolds Number Simulator",
    workedExample: {
      title: "น้ำในท่อประปา",
      body: (
        <>
          <p>น้ำ (ρ=1000, μ=0.001) ไหล V=1.2 m/s ในท่อ D=0.025 m. Re?</p>
          <p className="mt-1 font-mono">Re = ρVD/μ = (1000 × 1.2 × 0.025) / 0.001 = 30,000</p>
          <p className="mt-1">Re &gt; 4000 → การไหลเป็นแบบ turbulent</p>
        </>
      ),
    },
    keyTakeaways: [
      "Re = ρVD/μ (ไม่มีหน่วย)",
      "Re = แรงเฉื่อย / แรงหนืด",
      "ท่อกลม: <2300 laminar, >4000 turbulent",
    ],
    relatedFormulaIds: ["reynolds"],
    assumptions: <>เกณฑ์ 2300/4000 ใช้กับการไหลในท่อกลมเต็มท่อ การไหลแบบอื่นมีเกณฑ์ต่างกัน</>,
  },

  "pipe-loss": {
    concept: (
      <>
        <p>
          ของไหลจริงมีแรงหนืด การไหลในท่อจึงสูญเสียพลังงานเรียกว่า{" "}
          <Term termEn="Head loss">head loss</Term> แบ่งเป็นสองส่วน:
        </p>
        <ul className="ml-4 mt-1 list-disc space-y-1">
          <li><strong>Major loss</strong> จากแรงเสียดทานตลอดท่อ: h_f = f(L/D)·V²/2g</li>
          <li><strong>Minor loss</strong> จาก fitting/วาล์ว/ข้องอ: h_m = K·V²/2g</li>
        </ul>
        <p className="mt-2">
          ทั้งสองแปรผันตาม V² ดังนั้นความเร็วเพิ่ม 2 เท่า การสูญเสียเพิ่ม 4 เท่า
          ท่อยาวขึ้นหรือเล็กลงก็เสียพลังงานมากขึ้น
        </p>
      </>
    ),
    simulator: PipeLossSim,
    simulatorTitle: "ทดลอง: Pipe Loss Calculator",
    workedExample: {
      title: "Head loss ในท่อส่งน้ำ",
      body: (
        <>
          <p>f=0.02, L=100 m, D=0.1 m, V=2 m/s, ข้องอ 2 ตัว (K รวม = 1.8)</p>
          <p className="mt-1 font-mono">
            h_f = 0.02 × (100/0.1) × (2²/19.62) = 20 × 0.2039 ≈ 4.08 m
          </p>
          <p className="mt-1 font-mono">h_m = 1.8 × (2²/19.62) ≈ 0.37 m</p>
          <p className="mt-1">รวม ≈ 4.45 m (ปั๊มต้องชดเชยพลังงานส่วนนี้)</p>
        </>
      ),
    },
    keyTakeaways: [
      "h_f = f(L/D)·V²/2g (major), h_m = K·V²/2g (minor)",
      "head loss ∝ V² — ความเร็วเพิ่ม 2 เท่า เสีย 4 เท่า",
      "ท่อยาว/เล็ก/น้ำเร็ว = เสียพลังงานมากขึ้น",
    ],
    relatedFormulaIds: ["darcy-weisbach", "minor-loss"],
    assumptions: <>การไหลคงตัวเต็มท่อ; ค่า f ขึ้นกับ Re และความขรุขระของท่อ (อ่านจาก Moody chart)</>,
  },

  momentum: {
    concept: (
      <>
        <p>
          สมการโมเมนตัม (momentum equation) มาจากกฎข้อ 2 ของนิวตันสำหรับปริมาตร
          ควบคุม: แรงสุทธิ = อัตราการเปลี่ยนโมเมนตัมของของไหล
        </p>
        <p className="mt-2 font-mono text-center">F = ṁ (V_out − V_in)</p>
        <p className="mt-2">
          โดย ṁ = ρ·A·V คืออัตราการไหลมวล ตัวอย่างคลาสสิกคือเจ็ตน้ำพุ่งชนแผ่นตั้งฉาก
          ซึ่งโมเมนตัมแนวพุ่งกลายเป็นศูนย์ ทำให้เกิดแรง F = ρAV² หลักการนี้ใช้
          ออกแบบกังหันน้ำ ใบพัด และคำนวณแรงดันน้ำบนสิ่งกีดขวาง
        </p>
      </>
    ),
    simulator: MomentumSim,
    simulatorTitle: "ทดลอง: Jet on Plate (Momentum)",
    workedExample: {
      title: "แรงจากเจ็ตน้ำ",
      body: (
        <>
          <p>เจ็ตน้ำ D=0.02 m, V=10 m/s ชนแผ่นตั้งฉาก แรงเท่าใด?</p>
          <p className="mt-1 font-mono">A = π(0.01)² = 3.14×10⁻⁴ m²</p>
          <p className="mt-1 font-mono">F = ρAV² = 1000 × 3.14×10⁻⁴ × 10² ≈ 31.4 N</p>
        </>
      ),
    },
    keyTakeaways: [
      "F = ṁ(V_out − V_in), ṁ = ρAV",
      "เจ็ตชนแผ่นตั้งฉาก: F = ρAV²",
      "แรงจากของไหล ∝ V² — ใช้ออกแบบกังหันและใบพัด",
    ],
    relatedFormulaIds: ["flow-rate"],
    assumptions: <>steady flow, ปริมาตรควบคุมชัดเจน และไม่คิดแรงเสียดทาน/น้ำหนักในช่วงสั้น ๆ</>,
  },
};

export function getLessonContent(id: string): LessonContent | undefined {
  return LESSON_CONTENT[id];
}
