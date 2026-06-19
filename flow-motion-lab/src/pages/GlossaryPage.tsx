import { useMemo, useState } from "react";

interface GlossaryTerm {
  term: string;
  en: string;
  def: string;
  category: string;
}

const TERMS: GlossaryTerm[] = [
  // ── คุณสมบัติ (Properties) ──
  {
    term: "ความหนาแน่น",
    en: "Density",
    def: "มวลของของไหลต่อหนึ่งหน่วยปริมาตร (ρ = m/V) หน่วย kg/m³ เป็นพื้นฐานของเกือบทุกสมการ",
    category: "คุณสมบัติ",
  },
  {
    term: "น้ำหนักจำเพาะ",
    en: "Specific weight",
    def: "น้ำหนักของของไหลต่อหนึ่งหน่วยปริมาตร (γ = ρg) หน่วย N/m³ บอกแรงโน้มถ่วงต่อปริมาตร",
    category: "คุณสมบัติ",
  },
  {
    term: "ความถ่วงจำเพาะ",
    en: "Specific gravity",
    def: "อัตราส่วนความหนาแน่นของสารต่อความหนาแน่นน้ำ (SG = ρ/ρ_water) เป็นค่าไร้มิติ",
    category: "คุณสมบัติ",
  },
  {
    term: "ความหนืดพลวัต",
    en: "Dynamic viscosity",
    def: "ความต้านทานการเฉือนของของไหล (μ) หน่วย Pa·s ของไหลข้นมีค่ามาก",
    category: "คุณสมบัติ",
  },
  {
    term: "ความหนืดจลน์",
    en: "Kinematic viscosity",
    def: "อัตราส่วนความหนืดพลวัตต่อความหนาแน่น (ν = μ/ρ) หน่วย m²/s ใช้บ่อยใน Reynolds number",
    category: "คุณสมบัติ",
  },
  {
    term: "ของไหลนิวโทเนียน",
    en: "Newtonian fluid",
    def: "ของไหลที่ความเค้นเฉือนแปรผันตรงกับอัตราการเฉือน ความหนืดคงที่ เช่น น้ำ อากาศ",
    category: "คุณสมบัติ",
  },
  {
    term: "ของไหลไม่นิวโทเนียน",
    en: "Non-Newtonian fluid",
    def: "ของไหลที่ความหนืดเปลี่ยนตามอัตราการเฉือน เช่น เลือด ซอสมะเขือเทศ แป้งเปียก",
    category: "คุณสมบัติ",
  },
  {
    term: "แรงตึงผิว",
    en: "Surface tension",
    def: "แรงดึงที่ผิวของไหลซึ่งทำให้ผิวมีพฤติกรรมเหมือนแผ่นยืดหยุ่น (σ) หน่วย N/m",
    category: "คุณสมบัติ",
  },
  {
    term: "การซึมตามรูเล็ก",
    en: "Capillary action",
    def: "การที่ของไหลไต่ขึ้น/ลงในท่อเล็กเนื่องจากแรงตึงผิวและแรงยึดเหนี่ยวกับผนัง",
    category: "คุณสมบัติ",
  },
  {
    term: "ความดันไอ",
    en: "Vapor pressure",
    def: "ความดันที่ของเหลวเริ่มกลายเป็นไอที่อุณหภูมิหนึ่ง ถ้าความดันต่ำกว่านี้จะเกิดฟองไอ",
    category: "คุณสมบัติ",
  },
  {
    term: "คาวิเทชัน",
    en: "Cavitation",
    def: "การเกิดและยุบตัวของฟองไอเมื่อความดันลดต่ำกว่าความดันไอ ทำให้เกิดความเสียหายและเสียงดัง",
    category: "คุณสมบัติ",
  },

  // ── สถิตศาสตร์ (Statics) ──
  {
    term: "ความดัน",
    en: "Pressure",
    def: "แรงตั้งฉากต่อหนึ่งหน่วยพื้นที่ (P = F/A) หน่วย Pa = N/m²",
    category: "สถิตศาสตร์",
  },
  {
    term: "กฎของปาสคาล",
    en: "Pascal's law",
    def: "ความดันที่กระทำต่อของไหลที่ถูกกักจะส่งผ่านไปทุกทิศทางเท่ากัน เป็นหลักการของระบบไฮดรอลิก",
    category: "สถิตศาสตร์",
  },
  {
    term: "ความดันสถิต",
    en: "Hydrostatic pressure",
    def: "ความดันในของไหลที่อยู่นิ่ง ซึ่งเพิ่มตามความลึก (P = ρgh)",
    category: "สถิตศาสตร์",
  },
  {
    term: "มาโนมิเตอร์",
    en: "Manometer",
    def: "อุปกรณ์วัดความดันด้วยความสูงของคอลัมน์ของไหล อาศัยความสัมพันธ์ ΔP = ρgΔh",
    category: "สถิตศาสตร์",
  },
  {
    term: "จุดศูนย์กลางความดัน",
    en: "Center of pressure",
    def: "ตำแหน่งที่แรงดันลัพธ์ของของไหลกระทำบนพื้นผิวที่จม มักอยู่ต่ำกว่าจุดเซนทรอยด์",
    category: "สถิตศาสตร์",
  },
  {
    term: "แรงลอยตัว",
    en: "Buoyancy",
    def: "แรงยกที่ของไหลกระทำต่อวัตถุที่จม เท่ากับน้ำหนักของไหลที่ถูกแทนที่ (หลักอาร์คิมิดีส)",
    category: "สถิตศาสตร์",
  },
  {
    term: "เมตาเซนเตอร์",
    en: "Metacenter",
    def: "จุดที่ใช้พิจารณาเสถียรภาพของวัตถุลอยน้ำ ถ้าอยู่เหนือจุดศูนย์ถ่วงวัตถุจะลอยอย่างมั่นคง",
    category: "สถิตศาสตร์",
  },

  // ── จลนศาสตร์ (Kinematics) ──
  {
    term: "เส้นกระแส",
    en: "Streamline",
    def: "เส้นที่สัมผัสกับเวกเตอร์ความเร็วของไหลทุกจุด ณ ขณะหนึ่ง ของไหลไม่ไหลข้ามเส้นกระแส",
    category: "จลนศาสตร์",
  },
  {
    term: "เส้นริ้ว",
    en: "Streakline",
    def: "เส้นที่เกิดจากอนุภาคทั้งหมดที่เคยผ่านจุดเดียวกัน เช่น ควันที่ปล่อยจากจุดคงที่",
    category: "จลนศาสตร์",
  },
  {
    term: "เส้นทางเดิน",
    en: "Pathline",
    def: "เส้นทางจริงที่อนุภาคหนึ่งเคลื่อนที่ผ่านตามเวลา",
    category: "จลนศาสตร์",
  },
  {
    term: "สนามความเร็ว",
    en: "Velocity field",
    def: "การแจกแจงเวกเตอร์ความเร็วของของไหล ณ ทุกตำแหน่งและเวลา V(x,y,z,t)",
    category: "จลนศาสตร์",
  },
  {
    term: "ความหมุนวน",
    en: "Vorticity",
    def: "การวัดการหมุนเฉพาะที่ของของไหล (ω = ∇×V) บอกว่าธาตุของไหลหมุนรอบตัวเองมากแค่ไหน",
    category: "จลนศาสตร์",
  },
  {
    term: "การไหลแบบหมุน",
    en: "Rotational flow",
    def: "การไหลที่ธาตุของไหลมีการหมุนรอบตัวเอง (vorticity ไม่เป็นศูนย์)",
    category: "จลนศาสตร์",
  },
  {
    term: "การไหลแบบไม่หมุน",
    en: "Irrotational flow",
    def: "การไหลที่ธาตุของไหลไม่หมุนรอบตัวเอง (vorticity เป็นศูนย์) ใช้สมมติฐานนี้ใน potential flow",
    category: "จลนศาสตร์",
  },
  {
    term: "การไหลคงตัว",
    en: "Steady flow",
    def: "การไหลที่คุณสมบัติ ณ จุดใด ๆ ไม่เปลี่ยนตามเวลา (∂/∂t = 0)",
    category: "จลนศาสตร์",
  },
  {
    term: "การไหลไม่คงตัว",
    en: "Unsteady flow",
    def: "การไหลที่คุณสมบัติ ณ จุดใด ๆ เปลี่ยนแปลงตามเวลา เช่น น้ำขึ้นน้ำลง คลื่นกระแทก",
    category: "จลนศาสตร์",
  },

  // ── พลังงาน (Energy) ──
  {
    term: "ความต่อเนื่อง",
    en: "Continuity",
    def: "หลักการอนุรักษ์มวล สำหรับของไหลอัดตัวไม่ได้: A₁V₁ = A₂V₂",
    category: "พลังงาน",
  },
  {
    term: "ปริมาตรควบคุม",
    en: "Control volume",
    def: "บริเวณคงที่ในอวกาศที่เราพิจารณาการไหลเข้า-ออกเพื่อวิเคราะห์มวล โมเมนตัม และพลังงาน",
    category: "พลังงาน",
  },
  {
    term: "สมการเบอร์นูลลี",
    en: "Bernoulli equation",
    def: "อนุรักษ์พลังงานตามเส้นกระแส: P/ρg + V²/2g + z = ค่าคงที่ สำหรับของไหลอุดมคติ",
    category: "พลังงาน",
  },
  {
    term: "เฮดความดัน",
    en: "Pressure head",
    def: "พลังงานความดันในรูปความสูงของคอลัมน์ของไหล (P/ρg) หน่วย m",
    category: "พลังงาน",
  },
  {
    term: "เฮดความเร็ว",
    en: "Velocity head",
    def: "พลังงานจลน์ในรูปความสูง (V²/2g) หน่วย m",
    category: "พลังงาน",
  },
  {
    term: "เฮดความสูง",
    en: "Elevation head",
    def: "พลังงานศักย์เนื่องจากตำแหน่งความสูง (z) หน่วย m",
    category: "พลังงาน",
  },
  {
    term: "เส้นระดับไฮดรอลิก",
    en: "HGL (Hydraulic grade line)",
    def: "เส้นแสดงผลรวมของเฮดความดันกับเฮดความสูง (P/ρg + z) ตามแนวการไหล",
    category: "พลังงาน",
  },
  {
    term: "เส้นระดับพลังงาน",
    en: "EGL (Energy grade line)",
    def: "เส้นแสดงพลังงานรวมทั้งหมด (P/ρg + V²/2g + z) อยู่เหนือ HGL ด้วยเฮดความเร็ว",
    category: "พลังงาน",
  },
  {
    term: "การสูญเสียเฮด",
    en: "Head loss",
    def: "พลังงานที่สูญเสียจากแรงเสียดทานและความปั่นป่วนในระบบท่อ (h_loss)",
    category: "พลังงาน",
  },

  // ── โมเมนตัม (Momentum) ──
  {
    term: "สมการโมเมนตัม",
    en: "Momentum equation",
    def: "ใช้กฎข้อ 2 ของนิวตันกับปริมาตรควบคุม: ΣF = ṁ(V_out − V_in) หาแรงจากการเปลี่ยนโมเมนตัม",
    category: "โมเมนตัม",
  },

  // ── ไร้มิติ (Dimensionless) ──
  {
    term: "เลขเรย์โนลด์",
    en: "Reynolds number",
    def: "อัตราส่วนแรงเฉื่อยต่อแรงหนืด (Re = ρVD/μ) บอกว่าการไหลเป็น laminar หรือ turbulent",
    category: "ไร้มิติ",
  },
  {
    term: "เลขฟรูด",
    en: "Froude number",
    def: "อัตราส่วนแรงเฉื่อยต่อแรงโน้มถ่วง (Fr = V/√(gD)) สำคัญในรางเปิดและคลื่นผิวน้ำ",
    category: "ไร้มิติ",
  },
  {
    term: "เลขมัค",
    en: "Mach number",
    def: "อัตราส่วนความเร็วการไหลต่อความเร็วเสียง (Ma = V/a) บอกผลของการอัดตัว",
    category: "ไร้มิติ",
  },
  {
    term: "เลขเวเบอร์",
    en: "Weber number",
    def: "อัตราส่วนแรงเฉื่อยต่อแรงตึงผิว (We = ρV²L/σ) สำคัญในการแตกตัวเป็นละออง",
    category: "ไร้มิติ",
  },

  // ── ท่อ (Pipe flow) ──
  {
    term: "การไหลแบบราบเรียบ",
    en: "Laminar flow",
    def: "การไหลที่ของไหลเคลื่อนเป็นชั้น ๆ เรียบ ไม่ปะปนกัน เกิดเมื่อ Re ต่ำ (< 2300 ในท่อ)",
    category: "ท่อ",
  },
  {
    term: "การไหลแบบปั่นป่วน",
    en: "Turbulent flow",
    def: "การไหลที่มีการปะปนวุ่นวายและกระแสวน เกิดเมื่อ Re สูง (> 4000 ในท่อ)",
    category: "ท่อ",
  },
  {
    term: "ตัวประกอบความเสียดทาน",
    en: "Friction factor",
    def: "ค่าไร้มิติ (f) ในสมการ Darcy–Weisbach บอกการสูญเสียจากแรงเสียดทานในท่อ",
    category: "ท่อ",
  },
  {
    term: "แผนภูมิมูดี",
    en: "Moody chart",
    def: "กราฟแสดงความสัมพันธ์ของ friction factor กับ Reynolds number และความขรุขระสัมพัทธ์",
    category: "ท่อ",
  },
  {
    term: "ความขรุขระสัมพัทธ์",
    en: "Relative roughness",
    def: "อัตราส่วนความขรุขระของผนังท่อต่อเส้นผ่านศูนย์กลาง (ε/D) ใช้อ่านค่าจาก Moody chart",
    category: "ท่อ",
  },
  {
    term: "การสูญเสียรอง",
    en: "Minor loss",
    def: "การสูญเสียเฮดเฉพาะจุดจากข้อต่อ ข้องอ วาล์ว ทางเข้า-ออก (h_m = K V²/2g)",
    category: "ท่อ",
  },

  // ── ปั๊ม (Pumps) ──
  {
    term: "เฮดของปั๊ม",
    en: "Pump head",
    def: "พลังงานในรูปความสูงที่ปั๊มเพิ่มให้ของไหล (H) หน่วย m",
    category: "ปั๊ม",
  },
  {
    term: "เฮดดูดสุทธิบวก",
    en: "NPSH",
    def: "Net Positive Suction Head ความดันส่วนเกินเหนือความดันไอที่ทางดูด ป้องกันคาวิเทชัน",
    category: "ปั๊ม",
  },
  {
    term: "จุดทำงาน",
    en: "Operating point",
    def: "จุดตัดระหว่างเส้นโค้งของปั๊มกับเส้นโค้งของระบบ บอกอัตราการไหลและเฮดจริงที่ปั๊มทำงาน",
    category: "ปั๊ม",
  },

  // ── รางเปิด (Open channel) ──
  {
    term: "การไหลในรางเปิด",
    en: "Open channel flow",
    def: "การไหลที่มีผิวอิสระสัมผัสบรรยากาศ เช่น แม่น้ำ คลอง ท่อระบายน้ำที่ไม่เต็ม",
    category: "รางเปิด",
  },
  {
    term: "รัศมีไฮดรอลิก",
    en: "Hydraulic radius",
    def: "อัตราส่วนพื้นที่หน้าตัดการไหลต่อเส้นรอบเปียก (R = A/P_wetted) หน่วย m",
    category: "รางเปิด",
  },
  {
    term: "สมการแมนนิง",
    en: "Manning equation",
    def: "สูตรหาความเร็วในรางเปิด: V = (1/n)R^(2/3)√S เมื่อ n คือสัมประสิทธิ์ความขรุขระ",
    category: "รางเปิด",
  },
  {
    term: "การกระโดดไฮดรอลิก",
    en: "Hydraulic jump",
    def: "การเปลี่ยนจากการไหลเร็วตื้น (supercritical) ไปสู่การไหลช้าลึก (subcritical) อย่างฉับพลัน",
    category: "รางเปิด",
  },

  // ── ชั้นขอบเขต (Boundary layer) ──
  {
    term: "ชั้นขอบเขต",
    en: "Boundary layer",
    def: "ชั้นบาง ๆ ใกล้ผนังที่ความเร็วของไหลเปลี่ยนจากศูนย์ที่ผนังไปสู่ความเร็วกระแสหลัก",
    category: "ชั้นขอบเขต",
  },
  {
    term: "เงื่อนไขไม่ลื่นไถล",
    en: "No-slip condition",
    def: "ของไหลที่สัมผัสผนังมีความเร็วเท่ากับผนัง (เป็นศูนย์ถ้าผนังนิ่ง) เป็นต้นกำเนิดชั้นขอบเขต",
    category: "ชั้นขอบเขต",
  },
  {
    term: "การแยกตัวของการไหล",
    en: "Flow separation",
    def: "การที่ชั้นขอบเขตหลุดออกจากผิววัตถุเมื่อความดันเพิ่มทวน ทำให้เกิดบริเวณวนและแรงต้านสูง",
    category: "ชั้นขอบเขต",
  },
  {
    term: "เวก",
    en: "Wake",
    def: "บริเวณการไหลปั่นป่วนความเร็วต่ำด้านท้ายวัตถุที่เกิดจากการแยกตัวของการไหล",
    category: "ชั้นขอบเขต",
  },
  {
    term: "แรงต้าน",
    en: "Drag",
    def: "แรงในทิศทางการไหลที่ของไหลกระทำต่อวัตถุ (F_D = ½ρV²C_dA)",
    category: "ชั้นขอบเขต",
  },
  {
    term: "แรงยก",
    en: "Lift",
    def: "แรงตั้งฉากกับทิศทางการไหลที่ของไหลกระทำต่อวัตถุ (F_L = ½ρV²C_lA)",
    category: "ชั้นขอบเขต",
  },
  {
    term: "กระแสวนแบบบังคับ",
    en: "Forced vortex",
    def: "กระแสวนที่ของไหลหมุนเป็นวัตถุแข็งเกร็ง ความเร็วเชิงมุมคงที่ เช่น น้ำในถังที่หมุน",
    category: "จลนศาสตร์",
  },
  {
    term: "กระแสวนแบบอิสระ",
    en: "Free vortex",
    def: "กระแสวนที่ความเร็วแปรผกผันกับรัศมี (Vr = ค่าคงที่) เช่น น้ำวนลงท่อระบาย เป็นการไหลไม่หมุน",
    category: "จลนศาสตร์",
  },
  {
    term: "เซอร์คูเลชัน",
    en: "Circulation",
    def: "อินทิกรัลรอบของความเร็วตามเส้นปิด (Γ) เกี่ยวข้องโดยตรงกับแรงยกตามทฤษฎี Kutta–Joukowski",
    category: "จลนศาสตร์",
  },

  // ── อัดตัวได้ (Compressible) ──
  {
    term: "การไหลอัดตัวได้",
    en: "Compressible flow",
    def: "การไหลที่ความหนาแน่นเปลี่ยนแปลงอย่างมีนัยสำคัญ สำคัญเมื่อ Ma > 0.3",
    category: "อัดตัวได้",
  },
  {
    term: "ความเร็วเสียง",
    en: "Speed of sound",
    def: "ความเร็วที่คลื่นความดันเล็ก ๆ เดินทางในตัวกลาง (a) ใช้เป็นฐานของเลขมัค",
    category: "อัดตัวได้",
  },
  {
    term: "คลื่นกระแทก",
    en: "Shock wave",
    def: "การเปลี่ยนแปลงความดัน ความหนาแน่น และความเร็วอย่างฉับพลันในการไหลความเร็วเหนือเสียง",
    category: "อัดตัวได้",
  },
  {
    term: "การไหลอุดตัน",
    en: "Choked flow",
    def: "ภาวะที่อัตราการไหลถึงค่าสูงสุดเมื่อความเร็วที่คอท่อถึงความเร็วเสียง (Ma = 1)",
    category: "อัดตัวได้",
  },
];

const CATEGORY_ORDER = [
  "คุณสมบัติ",
  "สถิตศาสตร์",
  "จลนศาสตร์",
  "พลังงาน",
  "โมเมนตัม",
  "ไร้มิติ",
  "ท่อ",
  "ปั๊ม",
  "รางเปิด",
  "ชั้นขอบเขต",
  "อัดตัวได้",
];

export default function GlossaryPage() {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? TERMS.filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            t.en.toLowerCase().includes(q) ||
            t.def.toLowerCase().includes(q),
        )
      : TERMS;

    const byCategory = new Map<string, GlossaryTerm[]>();
    for (const t of filtered) {
      const list = byCategory.get(t.category) ?? [];
      list.push(t);
      byCategory.set(t.category, list);
    }

    const ordered = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      items: byCategory.get(c)!,
    }));
    // include any category not in the explicit order (safety)
    for (const [c, items] of byCategory) {
      if (!CATEGORY_ORDER.includes(c)) ordered.push({ category: c, items });
    }
    return ordered;
  }, [query]);

  const total = useMemo(
    () => grouped.reduce((n, g) => n + g.items.length, 0),
    [grouped],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          อภิธานศัพท์ <span className="text-flow-500">Glossary</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          คำศัพท์กลศาสตร์ของไหลครบทุกบท ค้นหาได้ทั้งภาษาไทย อังกฤษ และคำนิยาม
        </p>
      </header>

      <div className="mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ค้นหาคำศัพท์ เช่น เบอร์นูลลี, Reynolds, ความหนืด…"
          className="w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-ink outline-none focus:border-flow-500 focus:ring-2 focus:ring-flow-500/30"
          aria-label="ค้นหาคำศัพท์"
        />
        <p className="mt-2 text-xs text-ink-faint">
          พบ {total} คำศัพท์
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="lab-card p-8 text-center text-sm text-ink-soft">
          ไม่พบคำศัพท์ที่ตรงกับ “{query}”
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink">{group.category}</h2>
                <span className="lab-chip">{group.items.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((t) => (
                  <article key={t.en} className="lab-card p-4">
                    <h3 className="font-bold text-ink">
                      {t.term}{" "}
                      <span className="text-sm font-normal text-flow-600 dark:text-flow-300">
                        {t.en}
                      </span>
                    </h3>
                    <p className="mt-1.5 text-sm text-ink-soft">{t.def}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
