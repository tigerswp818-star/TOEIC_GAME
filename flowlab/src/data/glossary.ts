import type { GlossaryTerm } from "../types";

/** Mini-glossary used by the glossary page and inline tooltips. */
export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "ความดัน",
    termEn: "Pressure",
    definition: "แรงที่กระทำตั้งฉากต่อหนึ่งหน่วยพื้นที่ (P = F/A) หน่วย SI คือ ปาสคาล (Pa)",
  },
  {
    term: "ความหนาแน่น",
    termEn: "Density",
    definition: "มวลต่อหนึ่งหน่วยปริมาตร (ρ = m/V) หน่วย kg/m³ บอกว่าสารนั้น 'หนัก' แค่ไหนต่อปริมาตร",
  },
  {
    term: "ความหนืด",
    termEn: "Viscosity",
    definition: "ความต้านทานการไหลของของไหล ของเหลวที่หนืดมาก (เช่น น้ำผึ้ง) ไหลช้ากว่าน้ำ หน่วย Pa·s",
  },
  {
    term: "เส้นกระแส",
    termEn: "Streamline",
    definition: "เส้นที่แสดงทิศทางการเคลื่อนที่ของของไหล ณ ขณะหนึ่ง ของไหลจะไหลไปตามเส้นนี้โดยไม่ตัดกัน",
  },
  {
    term: "การสูญเสียเฮด",
    termEn: "Head loss",
    definition: "พลังงานต่อหน่วยน้ำหนัก (วัดเป็นความสูงของของไหล, m) ที่สูญเสียไปจากแรงเสียดทานในท่อและ fitting",
  },
  {
    term: "การไหลปั่นป่วน",
    termEn: "Turbulence",
    definition: "การไหลที่ไม่เป็นระเบียบ มีการหมุนวน (eddies) และการผสมกันสูง เกิดเมื่อ Reynolds number สูง",
  },
  {
    term: "การไหลแบบราบเรียบ",
    termEn: "Laminar flow",
    definition: "การไหลที่ของไหลเคลื่อนที่เป็นชั้น ๆ ขนานกัน ไม่ผสมข้ามชั้น เกิดเมื่อ Re < 2300 ในท่อกลม",
  },
  {
    term: "อัตราการไหล",
    termEn: "Flow rate",
    definition: "ปริมาตรของของไหลที่ผ่านหน้าตัดต่อหน่วยเวลา (Q = A·V) หน่วย m³/s",
  },
  {
    term: "เฮด",
    termEn: "Head",
    definition: "พลังงานของของไหลต่อหน่วยน้ำหนัก แสดงในหน่วยความสูง (m) แบ่งเป็น pressure head, velocity head และ elevation head",
  },
  {
    term: "แรงลอยตัว",
    termEn: "Buoyant force",
    definition: "แรงยกขึ้นที่ของไหลกระทำต่อวัตถุที่จมอยู่ เท่ากับน้ำหนักของของไหลที่ถูกแทนที่ (หลักอาร์คิมิดีส)",
  },
  {
    term: "ของไหลอัดตัวไม่ได้",
    termEn: "Incompressible flow",
    definition: "การไหลที่ถือว่าความหนาแน่นคงที่ ใช้ได้ดีกับของเหลว และแก๊สที่ความเร็วต่ำ (Mach < 0.3)",
  },
  {
    term: "การไหลคงตัว",
    termEn: "Steady flow",
    definition: "การไหลที่คุณสมบัติ ณ จุดใด ๆ ไม่เปลี่ยนตามเวลา (∂/∂t = 0)",
  },
];

export function findGlossary(termEn: string): GlossaryTerm | undefined {
  return GLOSSARY.find(
    (g) => g.termEn.toLowerCase() === termEn.toLowerCase(),
  );
}
