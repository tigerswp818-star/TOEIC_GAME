import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/math";

interface FormulaEntry {
  formula: string;
  name: string;
  vars: { symbol: string; meaning: string; unit: string }[];
  whenToUse: string;
  limits: string;
  example: string;
}

const FORMULAS: FormulaEntry[] = [
  {
    formula: "ρ = m / V",
    name: "ความหนาแน่น Density",
    vars: [
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "m", meaning: "มวล", unit: "kg" },
      { symbol: "V", meaning: "ปริมาตร", unit: "m³" },
    ],
    whenToUse: "หาความหนาแน่นของของไหลหรือวัตถุ ใช้เป็นพื้นฐานของเกือบทุกสูตร",
    limits: "สมมติว่าวัสดุเป็นเนื้อเดียวกัน (uniform)",
    example: "น้ำ 1 m³ มีมวล 1000 kg → ρ = 1000 kg/m³",
  },
  {
    formula: "P = F / A",
    name: "ความดัน Pressure",
    vars: [
      { symbol: "P", meaning: "ความดัน", unit: "Pa = N/m²" },
      { symbol: "F", meaning: "แรงตั้งฉาก", unit: "N" },
      { symbol: "A", meaning: "พื้นที่", unit: "m²" },
    ],
    whenToUse: "หาความดันจากแรงที่กระทำตั้งฉากต่อพื้นที่",
    limits: "แรงต้องตั้งฉากและกระจายสม่ำเสมอบนพื้นที่",
    example: "แรง 100 N บนพื้นที่ 0.5 m² → P = 200 Pa",
  },
  {
    formula: "P = ρ g h",
    name: "ความดันสถิตของของไหล Hydrostatic Pressure",
    vars: [
      { symbol: "P", meaning: "ความดันเกจที่ความลึก h", unit: "Pa" },
      { symbol: "ρ", meaning: "ความหนาแน่นของไหล", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "h", meaning: "ความลึก", unit: "m" },
    ],
    whenToUse: "หาความดันที่ความลึกใด ๆ ในของไหลที่อยู่นิ่ง (เขื่อน ถังน้ำ)",
    limits: "ของไหลอยู่นิ่ง ความหนาแน่นคงที่ เป็นความดันเกจ (ไม่รวมบรรยากาศ)",
    example: "น้ำลึก 10 m → P = 1000 × 9.81 × 10 ≈ 98,100 Pa",
  },
  {
    formula: "Fb = ρ g V",
    name: "แรงลอยตัว Buoyant Force",
    vars: [
      { symbol: "Fb", meaning: "แรงลอยตัว", unit: "N" },
      { symbol: "ρ", meaning: "ความหนาแน่นของไหล", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "V", meaning: "ปริมาตรของไหลที่ถูกแทนที่", unit: "m³" },
    ],
    whenToUse: "หาแรงดันลอยตัวที่ของไหลกระทำต่อวัตถุที่จมอยู่ (หลักอาร์คิมิดีส)",
    limits: "V คือปริมาตรส่วนที่จมเท่านั้น ของไหลอยู่นิ่ง",
    example: "วัตถุแทนที่น้ำ 0.002 m³ → Fb = 1000 × 9.81 × 0.002 ≈ 19.6 N",
  },
  {
    formula: "Q = A V",
    name: "อัตราการไหล Flow Rate",
    vars: [
      { symbol: "Q", meaning: "อัตราการไหลเชิงปริมาตร", unit: "m³/s" },
      { symbol: "A", meaning: "พื้นที่หน้าตัด", unit: "m²" },
      { symbol: "V", meaning: "ความเร็วเฉลี่ย", unit: "m/s" },
    ],
    whenToUse: "หาปริมาตรของไหลที่ไหลผ่านหน้าตัดต่อวินาที",
    limits: "ใช้ความเร็วเฉลี่ยทั่วหน้าตัด",
    example: "A = 0.1 m², V = 2 m/s → Q = 0.2 m³/s",
  },
  {
    formula: "A₁V₁ = A₂V₂",
    name: "สมการความต่อเนื่อง Continuity",
    vars: [
      { symbol: "A", meaning: "พื้นที่หน้าตัด", unit: "m²" },
      { symbol: "V", meaning: "ความเร็ว", unit: "m/s" },
    ],
    whenToUse: "หาความเร็วเมื่อท่อเปลี่ยนขนาด (ท่อแคบ → ไหลเร็วขึ้น)",
    limits: "ของไหลอัดตัวไม่ได้ (incompressible) และไหลคงตัว (steady)",
    example: "A₂ = A₁/2 → V₂ = 2V₁",
  },
  {
    formula: "P/ρg + V²/2g + z = ค่าคงที่",
    name: "สมการเบอร์นูลลี Bernoulli",
    vars: [
      { symbol: "P/ρg", meaning: "เฮดความดัน Pressure head", unit: "m" },
      { symbol: "V²/2g", meaning: "เฮดความเร็ว Velocity head", unit: "m" },
      { symbol: "z", meaning: "เฮดความสูง Elevation head", unit: "m" },
    ],
    whenToUse: "หาความสัมพันธ์ความดัน–ความเร็ว–ความสูง ตามแนว streamline (Venturi, ปีกเครื่องบิน)",
    limits: "ไหลคงตัว, อัดตัวไม่ได้, ไม่มีความหนืด (inviscid), ตามแนว streamline เดียวกัน",
    example: "คอท่อแคบ → V เพิ่ม → P ลด",
  },
  {
    formula: "Re = ρVD/μ",
    name: "เลขเรย์โนลด์ Reynolds Number",
    vars: [
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็ว", unit: "m/s" },
      { symbol: "D", meaning: "เส้นผ่านศูนย์กลางท่อ", unit: "m" },
      { symbol: "μ", meaning: "ความหนืดพลวัต", unit: "Pa·s" },
    ],
    whenToUse: "บอกว่าการไหลเป็น Laminar หรือ Turbulent (เทียบแรงเฉื่อยกับแรงหนืด)",
    limits: "เกณฑ์ Re<2300 laminar, >4000 turbulent ใช้กับการไหลในท่อกลม",
    example: "น้ำ V=1, D=0.05, μ=0.001 → Re ≈ 50,000 (turbulent)",
  },
  {
    formula: "hf = f (L/D)(V²/2g)",
    name: "การสูญเสียหลัก Major Head Loss (Darcy–Weisbach)",
    vars: [
      { symbol: "hf", meaning: "เฮดที่สูญเสียจากแรงเสียดทาน", unit: "m" },
      { symbol: "f", meaning: "factor แรงเสียดทาน", unit: "—" },
      { symbol: "L", meaning: "ความยาวท่อ", unit: "m" },
      { symbol: "D", meaning: "เส้นผ่านศูนย์กลาง", unit: "m" },
      { symbol: "V", meaning: "ความเร็ว", unit: "m/s" },
    ],
    whenToUse: "หาพลังงานที่สูญเสียจากแรงเสียดทานตลอดความยาวท่อ",
    limits: "f ขึ้นกับ Re และความขรุขระ; สูญเสีย ∝ V²",
    example: "เพิ่ม V เป็น 2 เท่า → hf เพิ่มเป็น 4 เท่า",
  },
  {
    formula: "hm = K (V²/2g)",
    name: "การสูญเสียรอง Minor Head Loss",
    vars: [
      { symbol: "hm", meaning: "เฮดที่สูญเสียจากข้อต่อ/วาล์ว", unit: "m" },
      { symbol: "K", meaning: "สัมประสิทธิ์การสูญเสีย", unit: "—" },
      { symbol: "V", meaning: "ความเร็ว", unit: "m/s" },
    ],
    whenToUse: "หาการสูญเสียเฉพาะจุด เช่น ข้องอ วาล์ว ทางเข้า–ออก",
    limits: "K ขึ้นกับชนิดของข้อต่อ (เปิดตาราง)",
    example: "ข้องอ 90° มี K ≈ 0.9",
  },
  {
    formula: "γ = ρ g",
    name: "น้ำหนักจำเพาะ Specific Weight",
    vars: [
      { symbol: "γ", meaning: "น้ำหนักจำเพาะ", unit: "N/m³" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
    ],
    whenToUse: "หาน้ำหนักของไหลต่อหนึ่งหน่วยปริมาตร ใช้ในงานสถิตศาสตร์ของไหล",
    limits: "g ขึ้นกับตำแหน่ง (ค่ามาตรฐาน 9.81 m/s²)",
    example: "น้ำ → γ = 1000 × 9.81 ≈ 9,810 N/m³",
  },
  {
    formula: "SG = ρ / ρ_water",
    name: "ความถ่วงจำเพาะ Specific Gravity",
    vars: [
      { symbol: "SG", meaning: "ความถ่วงจำเพาะ (ไร้มิติ)", unit: "—" },
      { symbol: "ρ", meaning: "ความหนาแน่นของสาร", unit: "kg/m³" },
      { symbol: "ρ_water", meaning: "ความหนาแน่นน้ำ ≈ 1000", unit: "kg/m³" },
    ],
    whenToUse: "เปรียบเทียบความหนาแน่นของสารกับน้ำ บอกว่าจะลอยหรือจม",
    limits: "อ้างอิงน้ำที่ 4°C; SG < 1 ลอยน้ำ, > 1 จม",
    example: "น้ำมัน ρ = 920 → SG = 0.92 (ลอยน้ำ)",
  },
  {
    formula: "τ = μ (du/dy)",
    name: "กฎความหนืดของนิวตัน Newton's Viscosity Law",
    vars: [
      { symbol: "τ", meaning: "ความเค้นเฉือน", unit: "Pa" },
      { symbol: "μ", meaning: "ความหนืดพลวัต", unit: "Pa·s" },
      { symbol: "du/dy", meaning: "อัตราการเฉือน (gradient ความเร็ว)", unit: "1/s" },
    ],
    whenToUse: "หาความเค้นเฉือนในของไหลนิวโทเนียน เช่น ฟิล์มน้ำมันหล่อลื่น",
    limits: "ใช้ได้กับของไหลนิวโทเนียนเท่านั้น (μ คงที่)",
    example: "μ=0.001, du/dy=100 → τ = 0.1 Pa",
  },
  {
    formula: "ν = μ / ρ",
    name: "ความหนืดจลน์ Kinematic Viscosity",
    vars: [
      { symbol: "ν", meaning: "ความหนืดจลน์", unit: "m²/s" },
      { symbol: "μ", meaning: "ความหนืดพลวัต", unit: "Pa·s" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
    ],
    whenToUse: "ใช้แทน μ/ρ ในเลขเรย์โนลด์และการวิเคราะห์การไหล",
    limits: "ขึ้นกับอุณหภูมิอย่างมาก",
    example: "น้ำ → ν = 0.001/1000 = 1×10⁻⁶ m²/s",
  },
  {
    formula: "ΔP = ρ g Δh",
    name: "มาโนมิเตอร์ Manometer",
    vars: [
      { symbol: "ΔP", meaning: "ผลต่างความดัน", unit: "Pa" },
      { symbol: "ρ", meaning: "ความหนาแน่นของไหลวัด", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "Δh", meaning: "ผลต่างระดับของไหล", unit: "m" },
    ],
    whenToUse: "วัดผลต่างความดันจากผลต่างความสูงคอลัมน์ในมาโนมิเตอร์",
    limits: "ของไหลอยู่นิ่ง ความหนาแน่นคงที่",
    example: "ปรอท Δh=0.1 m → ΔP = 13600 × 9.81 × 0.1 ≈ 13,340 Pa",
  },
  {
    formula: "ṁ = ρ Q",
    name: "อัตราการไหลเชิงมวล Mass Flow Rate",
    vars: [
      { symbol: "ṁ", meaning: "อัตราการไหลเชิงมวล", unit: "kg/s" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "Q", meaning: "อัตราการไหลเชิงปริมาตร", unit: "m³/s" },
    ],
    whenToUse: "หามวลของไหลที่ไหลผ่านต่อวินาที ใช้ในสมการพลังงานและโมเมนตัม",
    limits: "ใช้ความหนาแน่นที่จุดวัด",
    example: "น้ำ Q=0.2 → ṁ = 1000 × 0.2 = 200 kg/s",
  },
  {
    formula: "P₁/ρg + V₁²/2g + z₁ + h_pump = P₂/ρg + V₂²/2g + z₂ + h_turbine + h_loss",
    name: "เบอร์นูลลีขยาย Extended Bernoulli (ปั๊ม/กังหัน/สูญเสีย)",
    vars: [
      { symbol: "P/ρg", meaning: "เฮดความดัน", unit: "m" },
      { symbol: "V²/2g", meaning: "เฮดความเร็ว", unit: "m" },
      { symbol: "z", meaning: "เฮดความสูง", unit: "m" },
      { symbol: "h_pump", meaning: "เฮดที่ปั๊มเพิ่ม", unit: "m" },
      { symbol: "h_turbine", meaning: "เฮดที่กังหันดึงออก", unit: "m" },
      { symbol: "h_loss", meaning: "เฮดที่สูญเสีย", unit: "m" },
    ],
    whenToUse: "วิเคราะห์ระบบท่อจริงที่มีปั๊ม กังหัน และการสูญเสีย",
    limits: "ไหลคงตัว อัดตัวไม่ได้ ระหว่างจุดที่ 1 และ 2",
    example: "ปั๊มต้องเพิ่ม h_pump เพื่อชดเชย z และ h_loss",
  },
  {
    formula: "Fr = V / √(g D)",
    name: "เลขฟรูด Froude Number",
    vars: [
      { symbol: "Fr", meaning: "เลขฟรูด (ไร้มิติ)", unit: "—" },
      { symbol: "V", meaning: "ความเร็วการไหล", unit: "m/s" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "D", meaning: "ความลึก/ความยาวลักษณะ", unit: "m" },
    ],
    whenToUse: "จำแนกการไหลรางเปิด: Fr<1 subcritical, Fr>1 supercritical",
    limits: "ใช้กับการไหลที่มีผิวอิสระ (รางเปิด คลื่น)",
    example: "V=2, D=0.5 → Fr = 2/√(9.81×0.5) ≈ 0.9 (subcritical)",
  },
  {
    formula: "Ma = V / a",
    name: "เลขมัค Mach Number",
    vars: [
      { symbol: "Ma", meaning: "เลขมัค (ไร้มิติ)", unit: "—" },
      { symbol: "V", meaning: "ความเร็วการไหล", unit: "m/s" },
      { symbol: "a", meaning: "ความเร็วเสียงในตัวกลาง", unit: "m/s" },
    ],
    whenToUse: "บอกผลของการอัดตัว: Ma<0.3 ถือว่าอัดตัวไม่ได้",
    limits: "a ขึ้นกับชนิดและอุณหภูมิของก๊าซ",
    example: "อากาศ V=170, a≈340 → Ma = 0.5 (subsonic อัดตัวได้)",
  },
  {
    formula: "We = ρ V² L / σ",
    name: "เลขเวเบอร์ Weber Number",
    vars: [
      { symbol: "We", meaning: "เลขเวเบอร์ (ไร้มิติ)", unit: "—" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็ว", unit: "m/s" },
      { symbol: "L", meaning: "ความยาวลักษณะ", unit: "m" },
      { symbol: "σ", meaning: "แรงตึงผิว", unit: "N/m" },
    ],
    whenToUse: "เทียบแรงเฉื่อยกับแรงตึงผิว สำคัญในการแตกตัวเป็นละอองและฟอง",
    limits: "เกี่ยวข้องเมื่อแรงตึงผิวมีบทบาท (หยด ละออง)",
    example: "We สูง → หยดแตกง่าย",
  },
  {
    formula: "Q = π ΔP r⁴ / (8 μ L)",
    name: "ฮาเกน–ปวซอย Hagen–Poiseuille",
    vars: [
      { symbol: "Q", meaning: "อัตราการไหล", unit: "m³/s" },
      { symbol: "ΔP", meaning: "ผลต่างความดัน", unit: "Pa" },
      { symbol: "r", meaning: "รัศมีท่อ", unit: "m" },
      { symbol: "μ", meaning: "ความหนืดพลวัต", unit: "Pa·s" },
      { symbol: "L", meaning: "ความยาวท่อ", unit: "m" },
    ],
    whenToUse: "หาอัตราการไหลในท่อกลมเล็กที่ไหลแบบราบเรียบ (laminar)",
    limits: "ใช้กับ laminar fully-developed ในท่อกลมเท่านั้น; Q ∝ r⁴",
    example: "เพิ่มรัศมี 2 เท่า → Q เพิ่ม 16 เท่า",
  },
  {
    formula: "P = ρ g Q H / η",
    name: "กำลังปั๊ม Pump Power",
    vars: [
      { symbol: "P", meaning: "กำลังที่เพลาปั๊มต้องใช้", unit: "W" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "Q", meaning: "อัตราการไหล", unit: "m³/s" },
      { symbol: "H", meaning: "เฮดของปั๊ม", unit: "m" },
      { symbol: "η", meaning: "ประสิทธิภาพ (0–1)", unit: "—" },
    ],
    whenToUse: "หากำลังที่ปั๊มต้องการเพื่อยกของไหลด้วยอัตรา Q ที่เฮด H",
    limits: "η < 1 เสมอ; ใช้ ρgQH คือกำลังของไหลในอุดมคติ",
    example: "Q=0.05, H=20, η=0.7 → P = 1000×9.81×0.05×20/0.7 ≈ 14 kW",
  },
  {
    formula: "V = (1/n) R^(2/3) √S",
    name: "สมการแมนนิง Manning Equation",
    vars: [
      { symbol: "V", meaning: "ความเร็วเฉลี่ย", unit: "m/s" },
      { symbol: "n", meaning: "สัมประสิทธิ์ความขรุขระแมนนิง", unit: "—" },
      { symbol: "R", meaning: "รัศมีไฮดรอลิก", unit: "m" },
      { symbol: "S", meaning: "ความชันของท้องราง", unit: "m/m" },
    ],
    whenToUse: "หาความเร็ว/อัตราการไหลในรางเปิด (แม่น้ำ คลอง ท่อระบาย)",
    limits: "ใช้กับการไหลคงตัวสม่ำเสมอในรางเปิด; n ขึ้นกับชนิดผิว",
    example: "คอนกรีต n≈0.013; ดิน n≈0.025",
  },
  {
    formula: "R = A / P_wetted",
    name: "รัศมีไฮดรอลิก Hydraulic Radius",
    vars: [
      { symbol: "R", meaning: "รัศมีไฮดรอลิก", unit: "m" },
      { symbol: "A", meaning: "พื้นที่หน้าตัดการไหล", unit: "m²" },
      { symbol: "P_wetted", meaning: "เส้นรอบเปียก", unit: "m" },
    ],
    whenToUse: "ใช้ในสมการแมนนิงและการไหลในรางเปิดหรือท่อไม่กลม",
    limits: "P_wetted นับเฉพาะส่วนที่สัมผัสของไหล (ไม่รวมผิวอิสระ)",
    example: "ท่อกลมเต็ม → R = D/4",
  },
  {
    formula: "F_D = ½ ρ V² C_d A",
    name: "แรงต้าน Drag Force",
    vars: [
      { symbol: "F_D", meaning: "แรงต้าน", unit: "N" },
      { symbol: "ρ", meaning: "ความหนาแน่นของไหล", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็วสัมพัทธ์", unit: "m/s" },
      { symbol: "C_d", meaning: "สัมประสิทธิ์แรงต้าน", unit: "—" },
      { symbol: "A", meaning: "พื้นที่อ้างอิง (frontal)", unit: "m²" },
    ],
    whenToUse: "หาแรงต้านของอากาศ/น้ำต่อรถ เครื่องบิน วัตถุที่เคลื่อนที่",
    limits: "C_d ขึ้นกับรูปทรงและ Re; F_D ∝ V²",
    example: "ความเร็ว 2 เท่า → แรงต้าน 4 เท่า",
  },
  {
    formula: "F_L = ½ ρ V² C_l A",
    name: "แรงยก Lift Force",
    vars: [
      { symbol: "F_L", meaning: "แรงยก", unit: "N" },
      { symbol: "ρ", meaning: "ความหนาแน่นของไหล", unit: "kg/m³" },
      { symbol: "V", meaning: "ความเร็วสัมพัทธ์", unit: "m/s" },
      { symbol: "C_l", meaning: "สัมประสิทธิ์แรงยก", unit: "—" },
      { symbol: "A", meaning: "พื้นที่ปีกอ้างอิง", unit: "m²" },
    ],
    whenToUse: "หาแรงยกของปีกเครื่องบินหรือใบพัด",
    limits: "C_l ขึ้นกับมุมปะทะ; ถ้ามุมมากเกินไปเกิด stall",
    example: "เพิ่มความเร็วและพื้นที่ปีก → แรงยกมากขึ้น",
  },

  // ── หมวดสถานีสูบจ่ายน้ำ Pump Station ──
  {
    formula: "TDH = h_s + h_f + h_m + h_p",
    name: "เฮดรวมของระบบ Total Dynamic Head (TDH)",
    vars: [
      { symbol: "TDH", meaning: "เฮดรวมที่ปั๊มต้องสร้าง", unit: "m" },
      { symbol: "h_s", meaning: "เฮดสถิต (ความต่างระดับ)", unit: "m" },
      { symbol: "h_f", meaning: "การสูญเสียหลัก (เสียดทานท่อ)", unit: "m" },
      { symbol: "h_m", meaning: "การสูญเสียรอง (ข้อต่อ/วาล์ว)", unit: "m" },
      { symbol: "h_p", meaning: "เฮดความดันปลายทางที่ต้องการ", unit: "m" },
    ],
    whenToUse: "หาเฮดที่ปั๊มต้องสร้างเพื่อจ่ายน้ำตามต้องการ ใช้เลือกปั๊มและหาจุดทำงาน",
    limits: "รวมทุกองค์ประกอบของเฮด ณ จุดออกแบบ (design point)",
    example: "สถิต 20 + เสียดทาน 5 + รอง 1 + ความดัน 10 → TDH = 36 m",
  },
  {
    formula: "Ph = ρ g Q H",
    name: "กำลังของไหล Hydraulic Power",
    vars: [
      { symbol: "Ph", meaning: "กำลังที่ส่งให้ของไหล", unit: "W" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "Q", meaning: "อัตราการไหล", unit: "m³/s" },
      { symbol: "H", meaning: "เฮดของปั๊ม", unit: "m" },
    ],
    whenToUse: "กำลังในอุดมคติที่ปั๊มถ่ายให้ของไหล (ก่อนหักประสิทธิภาพ)",
    limits: "เป็นกำลังของไหลล้วน ๆ กำลังจริงที่ใช้มากกว่านี้เสมอ",
    example: "Q=0.05, H=36 → Ph = 1000×9.81×0.05×36 ≈ 17.7 kW",
  },
  {
    formula: "Pin = ρ g Q H / (η_p η_m η_d)",
    name: "กำลังไฟฟ้าเข้า Input Power (ปั๊ม+มอเตอร์+ไดร์ฟ)",
    vars: [
      { symbol: "Pin", meaning: "กำลังไฟฟ้าที่สถานีดึงจริง", unit: "W" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
      { symbol: "Q", meaning: "อัตราการไหล", unit: "m³/s" },
      { symbol: "H", meaning: "เฮด", unit: "m" },
      { symbol: "η_p η_m η_d", meaning: "ประสิทธิภาพปั๊ม×มอเตอร์×ไดร์ฟ", unit: "—" },
    ],
    whenToUse: "หากำลังไฟฟ้าที่ใช้จริง เพื่อคำนวณค่าไฟและพลังงานจำเพาะ",
    limits: "ประสิทธิภาพแต่ละชั้น < 1 เสมอ จึงทำให้ Pin > Ph มาก",
    example: "Ph 17.7 kW, η รวม 0.67 → Pin ≈ 26.4 kW",
  },
  {
    formula: "Q₂ = Q₁ (N₂/N₁)",
    name: "Affinity Law — อัตราการไหล ∝ รอบ",
    vars: [
      { symbol: "Q₂", meaning: "อัตราการไหลใหม่", unit: "m³/h" },
      { symbol: "Q₁", meaning: "อัตราการไหลเดิม", unit: "m³/h" },
      { symbol: "N₁", meaning: "รอบเดิม", unit: "rpm" },
      { symbol: "N₂", meaning: "รอบใหม่", unit: "rpm" },
    ],
    whenToUse: "ทำนายอัตราการไหลเมื่อ VFD เปลี่ยนรอบปั๊ม",
    limits: "ใช้กับปั๊มหอยโข่งตัวเดิม ระบบไม่เปลี่ยน",
    example: "ลดรอบเหลือครึ่ง → Q เหลือครึ่ง",
  },
  {
    formula: "H₂ = H₁ (N₂/N₁)²",
    name: "Affinity Law — เฮด ∝ รอบกำลังสอง",
    vars: [
      { symbol: "H₂", meaning: "เฮดใหม่", unit: "m" },
      { symbol: "H₁", meaning: "เฮดเดิม", unit: "m" },
      { symbol: "N₁", meaning: "รอบเดิม", unit: "rpm" },
      { symbol: "N₂", meaning: "รอบใหม่", unit: "rpm" },
    ],
    whenToUse: "ทำนายเฮดเมื่อเปลี่ยนรอบปั๊ม",
    limits: "ปั๊มตัวเดิม ของไหลเดิม",
    example: "ลดรอบเหลือครึ่ง → H เหลือ 1/4",
  },
  {
    formula: "P₂ = P₁ (N₂/N₁)³",
    name: "Affinity Law — กำลัง ∝ รอบกำลังสาม",
    vars: [
      { symbol: "P₂", meaning: "กำลังใหม่", unit: "kW" },
      { symbol: "P₁", meaning: "กำลังเดิม", unit: "kW" },
      { symbol: "N₁", meaning: "รอบเดิม", unit: "rpm" },
      { symbol: "N₂", meaning: "รอบใหม่", unit: "rpm" },
    ],
    whenToUse: "เหตุผลหลักที่ VFD ประหยัดพลังงาน — ลดรอบเล็กน้อย กำลังลดมาก",
    limits: "ปั๊มตัวเดิม; ในระบบจริงเฮดสถิตทำให้ประหยัดน้อยกว่าทฤษฎีเล็กน้อย",
    example: "ลดรอบเหลือ 80% → กำลังเหลือ ≈ 51%",
  },
  {
    formula: "Ns = 120 f / p",
    name: "ความเร็วซิงโครนัส Synchronous Speed",
    vars: [
      { symbol: "Ns", meaning: "ความเร็วสนามแม่เหล็ก", unit: "rpm" },
      { symbol: "f", meaning: "ความถี่ไฟฟ้า", unit: "Hz" },
      { symbol: "p", meaning: "จำนวนขั้วมอเตอร์ (poles)", unit: "—" },
    ],
    whenToUse: "หาความเร็วฐานของมอเตอร์เหนี่ยวนำตามความถี่และจำนวนขั้ว",
    limits: "ความเร็วจริง (Nr) จะต่ำกว่า Ns เล็กน้อยเพราะสลิป",
    example: "f=50 Hz, p=4 → Ns = 1500 rpm",
  },
  {
    formula: "s = (Ns − Nr) / Ns",
    name: "สลิปมอเตอร์ Motor Slip",
    vars: [
      { symbol: "s", meaning: "สลิป (สัดส่วน)", unit: "—" },
      { symbol: "Ns", meaning: "ความเร็วซิงโครนัส", unit: "rpm" },
      { symbol: "Nr", meaning: "ความเร็วโรเตอร์จริง", unit: "rpm" },
    ],
    whenToUse: "บอกภาระมอเตอร์เหนี่ยวนำ — โหลดมากสลิปมาก",
    limits: "มอเตอร์เหนี่ยวนำมีสลิปเสมอ (ซิงโครนัส s=0)",
    example: "Ns=1500, Nr=1450 → s = 0.033 (3.3%)",
  },
  {
    formula: "P = √3 V I PF η",
    name: "กำลังมอเตอร์ 3 เฟส Three-phase Power",
    vars: [
      { symbol: "P", meaning: "กำลังกลที่เพลา (โดยประมาณ)", unit: "W" },
      { symbol: "V", meaning: "แรงดันไลน์", unit: "V" },
      { symbol: "I", meaning: "กระแสไลน์", unit: "A" },
      { symbol: "PF", meaning: "ตัวประกอบกำลัง (0–1)", unit: "—" },
      { symbol: "η", meaning: "ประสิทธิภาพมอเตอร์", unit: "—" },
    ],
    whenToUse: "ประมาณกำลังกล/ไฟฟ้าของมอเตอร์ 3 เฟสจากค่าที่วัดได้",
    limits: "เป็นการประมาณเชิงการเรียนรู้ ไม่ใช่การวัดเพื่อตั้งระบบจริง",
    example: "400V, 10A, PF 0.85, η 0.9 → P ≈ 5.3 kW",
  },
  {
    formula: "SEC = E / Vol",
    name: "พลังงานจำเพาะ Specific Energy (kWh/m³)",
    vars: [
      { symbol: "SEC", meaning: "พลังงานต่อปริมาตรน้ำ", unit: "kWh/m³" },
      { symbol: "E", meaning: "พลังงานไฟฟ้าที่ใช้", unit: "kWh" },
      { symbol: "Vol", meaning: "ปริมาตรน้ำที่จ่ายได้", unit: "m³" },
    ],
    whenToUse: "ตัวชี้วัดประสิทธิภาพสถานี — ยิ่งต่ำยิ่งประหยัด",
    limits: "เทียบได้ดีเมื่อเงื่อนไขเฮด/คุณภาพน้ำใกล้เคียงกัน",
    example: "100 kWh จ่ายน้ำ 500 m³ → SEC = 0.2 kWh/m³",
  },
  {
    formula: "η_total = η_p × η_m × η_d",
    name: "ประสิทธิภาพรวม Overall Efficiency",
    vars: [
      { symbol: "η_total", meaning: "ประสิทธิภาพรวมทั้งระบบ", unit: "—" },
      { symbol: "η_p", meaning: "ประสิทธิภาพปั๊ม", unit: "—" },
      { symbol: "η_m", meaning: "ประสิทธิภาพมอเตอร์", unit: "—" },
      { symbol: "η_d", meaning: "ประสิทธิภาพไดร์ฟ/VFD", unit: "—" },
    ],
    whenToUse: "หาประสิทธิภาพรวมจากต้นทางถึงของไหล (wire-to-water)",
    limits: "ทุกชั้นคูณกัน — จุดอ่อนชั้นเดียวลดทั้งระบบ",
    example: "0.75 × 0.92 × 0.97 ≈ 0.67 (67%)",
  },
  {
    formula: "ΔP = ρ a ΔV",
    name: "ค้อนน้ำ–ความดันกระชาก Water Hammer (Joukowsky)",
    vars: [
      { symbol: "ΔP", meaning: "ความดันกระชากสูงสุด", unit: "Pa" },
      { symbol: "ρ", meaning: "ความหนาแน่น", unit: "kg/m³" },
      { symbol: "a", meaning: "ความเร็วคลื่นความดันในท่อ", unit: "m/s" },
      { symbol: "ΔV", meaning: "การเปลี่ยนความเร็วของน้ำ", unit: "m/s" },
    ],
    whenToUse: "ประเมินแรงดันกระชากเมื่อปิดวาล์ว/ปั๊มหยุดเร็ว (กรณีปิดเร็วกว่าคาบคลื่น)",
    limits: "เป็นค่าสูงสุดเชิงทฤษฎี (ปิดเร็วมาก) ปิดช้าลงจะลดความรุนแรง",
    example: "ρ1000, a1200, ΔV2 → ΔP = 2.4×10⁶ Pa (2.4 MPa)",
  },
  {
    formula: "ΔH = a ΔV / g",
    name: "ค้อนน้ำ–เฮดกระชาก Water Hammer Head Rise",
    vars: [
      { symbol: "ΔH", meaning: "เฮดกระชากสูงสุด", unit: "m" },
      { symbol: "a", meaning: "ความเร็วคลื่น", unit: "m/s" },
      { symbol: "ΔV", meaning: "การเปลี่ยนความเร็ว", unit: "m/s" },
      { symbol: "g", meaning: "ความเร่งโน้มถ่วง", unit: "m/s²" },
    ],
    whenToUse: "แปลงความดันกระชากเป็นเฮด เพื่อเทียบพิกัดท่อ",
    limits: "เช่นเดียวกับ Joukowsky (กรณีปิดเร็ว)",
    example: "a1200, ΔV2 → ΔH = 1200×2/9.81 ≈ 245 m",
  },
  {
    formula: "kWh = kW × hr",
    name: "พลังงานไฟฟ้า Energy (kWh)",
    vars: [
      { symbol: "kWh", meaning: "พลังงาน (หน่วยไฟ)", unit: "kWh" },
      { symbol: "kW", meaning: "กำลังไฟฟ้า", unit: "kW" },
      { symbol: "hr", meaning: "ชั่วโมงทำงาน", unit: "h" },
    ],
    whenToUse: "หาพลังงานที่ใช้เพื่อคำนวณค่าไฟ",
    limits: "ใช้กำลังเฉลี่ยในช่วงเวลานั้น",
    example: "26.4 kW × 24 h = 633.6 kWh/วัน",
  },
];

const G = 9.81;

interface CalcInput {
  symbol: string;
  unit: string;
  default: number;
}
interface CalcConfig {
  result: { symbol: string; unit: string };
  inputs: CalcInput[];
  /** Compute the result from the inputs (same order as `inputs`). */
  fn: (v: number[]) => number;
}

/**
 * Live calculators keyed by the formula string. Most solve for the subject
 * variable; a few conceptual relations (Bernoulli head sum, extended Bernoulli)
 * have no single-output calculator and are intentionally omitted.
 */
const CALCS: Record<string, CalcConfig> = {
  "ρ = m / V": { result: { symbol: "ρ", unit: "kg/m³" }, inputs: [{ symbol: "m", unit: "kg", default: 1000 }, { symbol: "V", unit: "m³", default: 1 }], fn: ([m, V]) => m / V },
  "P = F / A": { result: { symbol: "P", unit: "Pa" }, inputs: [{ symbol: "F", unit: "N", default: 100 }, { symbol: "A", unit: "m²", default: 0.5 }], fn: ([F, A]) => F / A },
  "P = ρ g h": { result: { symbol: "P", unit: "Pa" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "h", unit: "m", default: 10 }], fn: ([r, g, h]) => r * g * h },
  "Fb = ρ g V": { result: { symbol: "Fb", unit: "N" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "V", unit: "m³", default: 0.002 }], fn: ([r, g, V]) => r * g * V },
  "Q = A V": { result: { symbol: "Q", unit: "m³/s" }, inputs: [{ symbol: "A", unit: "m²", default: 0.1 }, { symbol: "V", unit: "m/s", default: 2 }], fn: ([A, V]) => A * V },
  "A₁V₁ = A₂V₂": { result: { symbol: "V₂", unit: "m/s" }, inputs: [{ symbol: "A₁", unit: "m²", default: 0.3 }, { symbol: "V₁", unit: "m/s", default: 2 }, { symbol: "A₂", unit: "m²", default: 0.1 }], fn: ([a1, v1, a2]) => (a1 * v1) / a2 },
  "Re = ρVD/μ": { result: { symbol: "Re", unit: "—" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "V", unit: "m/s", default: 1 }, { symbol: "D", unit: "m", default: 0.05 }, { symbol: "μ", unit: "Pa·s", default: 0.001 }], fn: ([r, V, D, m]) => (r * V * D) / m },
  "hf = f (L/D)(V²/2g)": { result: { symbol: "hf", unit: "m" }, inputs: [{ symbol: "f", unit: "—", default: 0.02 }, { symbol: "L", unit: "m", default: 100 }, { symbol: "D", unit: "m", default: 0.1 }, { symbol: "V", unit: "m/s", default: 2 }], fn: ([f, L, D, V]) => f * (L / D) * ((V * V) / (2 * G)) },
  "hm = K (V²/2g)": { result: { symbol: "hm", unit: "m" }, inputs: [{ symbol: "K", unit: "—", default: 0.9 }, { symbol: "V", unit: "m/s", default: 2 }], fn: ([K, V]) => K * ((V * V) / (2 * G)) },
  "γ = ρ g": { result: { symbol: "γ", unit: "N/m³" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }], fn: ([r, g]) => r * g },
  "SG = ρ / ρ_water": { result: { symbol: "SG", unit: "—" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 920 }, { symbol: "ρ_water", unit: "kg/m³", default: 1000 }], fn: ([r, rw]) => r / rw },
  "τ = μ (du/dy)": { result: { symbol: "τ", unit: "Pa" }, inputs: [{ symbol: "μ", unit: "Pa·s", default: 0.001 }, { symbol: "du/dy", unit: "1/s", default: 100 }], fn: ([m, dudy]) => m * dudy },
  "ν = μ / ρ": { result: { symbol: "ν", unit: "m²/s" }, inputs: [{ symbol: "μ", unit: "Pa·s", default: 0.001 }, { symbol: "ρ", unit: "kg/m³", default: 1000 }], fn: ([m, r]) => m / r },
  "ΔP = ρ g Δh": { result: { symbol: "ΔP", unit: "Pa" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 13600 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "Δh", unit: "m", default: 0.1 }], fn: ([r, g, h]) => r * g * h },
  "ṁ = ρ Q": { result: { symbol: "ṁ", unit: "kg/s" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "Q", unit: "m³/s", default: 0.2 }], fn: ([r, Q]) => r * Q },
  "Fr = V / √(g D)": { result: { symbol: "Fr", unit: "—" }, inputs: [{ symbol: "V", unit: "m/s", default: 2 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "D", unit: "m", default: 0.5 }], fn: ([V, g, D]) => V / Math.sqrt(g * D) },
  "Ma = V / a": { result: { symbol: "Ma", unit: "—" }, inputs: [{ symbol: "V", unit: "m/s", default: 170 }, { symbol: "a", unit: "m/s", default: 340 }], fn: ([V, a]) => V / a },
  "We = ρ V² L / σ": { result: { symbol: "We", unit: "—" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "V", unit: "m/s", default: 1 }, { symbol: "L", unit: "m", default: 0.01 }, { symbol: "σ", unit: "N/m", default: 0.072 }], fn: ([r, V, L, s]) => (r * V * V * L) / s },
  "Q = π ΔP r⁴ / (8 μ L)": { result: { symbol: "Q", unit: "m³/s" }, inputs: [{ symbol: "ΔP", unit: "Pa", default: 1000 }, { symbol: "r", unit: "m", default: 0.005 }, { symbol: "μ", unit: "Pa·s", default: 0.001 }, { symbol: "L", unit: "m", default: 1 }], fn: ([dp, r, m, L]) => (Math.PI * dp * Math.pow(r, 4)) / (8 * m * L) },
  "P = ρ g Q H / η": { result: { symbol: "P", unit: "W" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "Q", unit: "m³/s", default: 0.05 }, { symbol: "H", unit: "m", default: 20 }, { symbol: "η", unit: "—", default: 0.7 }], fn: ([r, g, Q, H, e]) => (r * g * Q * H) / e },
  "V = (1/n) R^(2/3) √S": { result: { symbol: "V", unit: "m/s" }, inputs: [{ symbol: "n", unit: "—", default: 0.013 }, { symbol: "R", unit: "m", default: 0.5 }, { symbol: "S", unit: "m/m", default: 0.001 }], fn: ([n, R, S]) => (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S) },
  "R = A / P_wetted": { result: { symbol: "R", unit: "m" }, inputs: [{ symbol: "A", unit: "m²", default: 1 }, { symbol: "P_wetted", unit: "m", default: 4 }], fn: ([A, P]) => A / P },
  "F_D = ½ ρ V² C_d A": { result: { symbol: "F_D", unit: "N" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1.2 }, { symbol: "V", unit: "m/s", default: 20 }, { symbol: "C_d", unit: "—", default: 0.3 }, { symbol: "A", unit: "m²", default: 2 }], fn: ([r, V, cd, A]) => 0.5 * r * V * V * cd * A },
  "F_L = ½ ρ V² C_l A": { result: { symbol: "F_L", unit: "N" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1.2 }, { symbol: "V", unit: "m/s", default: 50 }, { symbol: "C_l", unit: "—", default: 0.5 }, { symbol: "A", unit: "m²", default: 15 }], fn: ([r, V, cl, A]) => 0.5 * r * V * V * cl * A },

  // ── หมวดสถานีสูบจ่ายน้ำ Pump Station ──
  "TDH = h_s + h_f + h_m + h_p": { result: { symbol: "TDH", unit: "m" }, inputs: [{ symbol: "h_s", unit: "m", default: 20 }, { symbol: "h_f", unit: "m", default: 5 }, { symbol: "h_m", unit: "m", default: 1 }, { symbol: "h_p", unit: "m", default: 10 }], fn: ([hs, hf, hm, hp]) => hs + hf + hm + hp },
  "Ph = ρ g Q H": { result: { symbol: "Ph", unit: "W" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "Q", unit: "m³/s", default: 0.05 }, { symbol: "H", unit: "m", default: 36 }], fn: ([r, g, Q, H]) => r * g * Q * H },
  "Pin = ρ g Q H / (η_p η_m η_d)": { result: { symbol: "Pin", unit: "W" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "g", unit: "m/s²", default: G }, { symbol: "Q", unit: "m³/s", default: 0.05 }, { symbol: "H", unit: "m", default: 36 }, { symbol: "η_p", unit: "—", default: 0.75 }, { symbol: "η_m", unit: "—", default: 0.92 }, { symbol: "η_d", unit: "—", default: 0.97 }], fn: ([r, g, Q, H, ep, em, ed]) => (r * g * Q * H) / (ep * em * ed) },
  "Q₂ = Q₁ (N₂/N₁)": { result: { symbol: "Q₂", unit: "m³/h" }, inputs: [{ symbol: "Q₁", unit: "m³/h", default: 50 }, { symbol: "N₁", unit: "rpm", default: 1450 }, { symbol: "N₂", unit: "rpm", default: 1160 }], fn: ([q1, n1, n2]) => q1 * (n2 / n1) },
  "H₂ = H₁ (N₂/N₁)²": { result: { symbol: "H₂", unit: "m" }, inputs: [{ symbol: "H₁", unit: "m", default: 36 }, { symbol: "N₁", unit: "rpm", default: 1450 }, { symbol: "N₂", unit: "rpm", default: 1160 }], fn: ([h1, n1, n2]) => h1 * Math.pow(n2 / n1, 2) },
  "P₂ = P₁ (N₂/N₁)³": { result: { symbol: "P₂", unit: "kW" }, inputs: [{ symbol: "P₁", unit: "kW", default: 26.4 }, { symbol: "N₁", unit: "rpm", default: 1450 }, { symbol: "N₂", unit: "rpm", default: 1160 }], fn: ([p1, n1, n2]) => p1 * Math.pow(n2 / n1, 3) },
  "Ns = 120 f / p": { result: { symbol: "Ns", unit: "rpm" }, inputs: [{ symbol: "f", unit: "Hz", default: 50 }, { symbol: "p", unit: "—", default: 4 }], fn: ([f, p]) => (120 * f) / p },
  "s = (Ns − Nr) / Ns": { result: { symbol: "s", unit: "—" }, inputs: [{ symbol: "Ns", unit: "rpm", default: 1500 }, { symbol: "Nr", unit: "rpm", default: 1450 }], fn: ([ns, nr]) => (ns - nr) / ns },
  "P = √3 V I PF η": { result: { symbol: "P", unit: "W" }, inputs: [{ symbol: "V", unit: "V", default: 400 }, { symbol: "I", unit: "A", default: 10 }, { symbol: "PF", unit: "—", default: 0.85 }, { symbol: "η", unit: "—", default: 0.9 }], fn: ([V, I, pf, e]) => Math.sqrt(3) * V * I * pf * e },
  "SEC = E / Vol": { result: { symbol: "SEC", unit: "kWh/m³" }, inputs: [{ symbol: "E", unit: "kWh", default: 100 }, { symbol: "Vol", unit: "m³", default: 500 }], fn: ([E, V]) => E / V },
  "η_total = η_p × η_m × η_d": { result: { symbol: "η_total", unit: "—" }, inputs: [{ symbol: "η_p", unit: "—", default: 0.75 }, { symbol: "η_m", unit: "—", default: 0.92 }, { symbol: "η_d", unit: "—", default: 0.97 }], fn: ([ep, em, ed]) => ep * em * ed },
  "ΔP = ρ a ΔV": { result: { symbol: "ΔP", unit: "Pa" }, inputs: [{ symbol: "ρ", unit: "kg/m³", default: 1000 }, { symbol: "a", unit: "m/s", default: 1200 }, { symbol: "ΔV", unit: "m/s", default: 2 }], fn: ([r, a, dv]) => r * a * dv },
  "ΔH = a ΔV / g": { result: { symbol: "ΔH", unit: "m" }, inputs: [{ symbol: "a", unit: "m/s", default: 1200 }, { symbol: "ΔV", unit: "m/s", default: 2 }, { symbol: "g", unit: "m/s²", default: G }], fn: ([a, dv, g]) => (a * dv) / g },
  "kWh = kW × hr": { result: { symbol: "kWh", unit: "kWh" }, inputs: [{ symbol: "kW", unit: "kW", default: 26.4 }, { symbol: "hr", unit: "h", default: 24 }], fn: ([kw, hr]) => kw * hr },
};

/** Live calculator for one formula — inputs morph the result instantly. */
function CalcPanel({ calc }: { calc: CalcConfig }) {
  const [raw, setRaw] = useState<string[]>(() => calc.inputs.map((i) => String(i.default)));
  const nums = raw.map((r) => parseFloat(r));
  const ok = nums.every((n) => Number.isFinite(n));
  const result = ok ? calc.fn(nums) : NaN;
  return (
    <section className="mt-4 rounded-xl border border-flow-500/30 bg-gradient-to-br from-flow-500/[0.08] to-iris-500/[0.06] p-4">
      <h3 className="text-sm font-bold text-flow-700 dark:text-flow-200">🧮 เครื่องคิดเลข</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {calc.inputs.map((inp, i) => (
          <label key={inp.symbol} className="block">
            <span className="block text-xs font-medium text-ink-soft">
              <span className="font-mono font-semibold text-flow-600 dark:text-flow-300">{inp.symbol}</span>{" "}
              <span className="text-ink-faint">({inp.unit})</span>
            </span>
            <input
              type="number"
              value={raw[i]}
              onChange={(e) => setRaw((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-right font-mono text-sm tabular-nums text-ink focus:border-flow-400 focus:outline-none focus:ring-1 focus:ring-flow-400/40"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl border border-flow-500/30 bg-surface-raised/70 px-4 py-3 shadow-glow">
        <span className="font-mono text-sm font-semibold text-flow-600 dark:text-flow-300">{calc.result.symbol} =</span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold tabular-nums text-ink">{ok ? formatNumber(result, 4) : "—"}</span>
          <span className="text-xs text-ink-soft">{calc.result.unit}</span>
        </span>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">ปรับค่าตัวแปรด้านบน ผลลัพธ์อัปเดตทันที</p>
    </section>
  );
}

/** Modal showing a formula's details + live calculator. */
function FormulaModal({ entry, onClose }: { entry: FormulaEntry; onClose: () => void }) {
  const calc = CALCS[entry.formula];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={entry.name}>
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg animate-rise overflow-auto rounded-2xl border border-white/10 bg-surface-raised/95 p-5 shadow-glass backdrop-blur-xl">
        <button type="button" onClick={onClose} aria-label="ปิด" className="lab-btn-ghost absolute right-3 top-3 !px-2.5 !py-1.5 !text-sm">
          ✕
        </button>
        <h2 className="pr-10 text-lg font-bold text-ink">{entry.name}</h2>
        <div className="relative mt-3 overflow-hidden rounded-xl border border-flow-500/30 bg-gradient-to-br from-flow-500/[0.1] to-iris-500/[0.06] px-4 py-3">
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-flow-400 to-iris-500" />
          <span className="font-mono text-base font-semibold text-ink sm:text-lg">{entry.formula}</span>
        </div>

        {calc ? (
          <CalcPanel calc={calc} />
        ) : (
          <p className="mt-4 rounded-xl border border-line bg-surface-soft px-4 py-3 text-sm text-ink-soft">
            สูตรนี้เป็นความสัมพันธ์เชิงแนวคิด — ใช้ดูหลักการ (ยังไม่มีเครื่องคิดเลขเฉพาะ)
          </p>
        )}

        <dl className="mt-4 space-y-1 text-xs">
          {entry.vars.map((v) => (
            <div key={v.symbol} className="flex gap-2">
              <dt className="w-20 shrink-0 font-mono font-semibold text-flow-600 dark:text-flow-300">{v.symbol}</dt>
              <dd className="text-ink-soft">
                {v.meaning} <span className="text-ink-faint">({v.unit})</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 space-y-1.5 text-xs">
          <p>
            <span className="font-semibold text-ink">📌 ใช้เมื่อ:</span> <span className="text-ink-soft">{entry.whenToUse}</span>
          </p>
          <p>
            <span className="font-semibold text-ink">⚠️ ข้อจำกัด:</span> <span className="text-ink-soft">{entry.limits}</span>
          </p>
          <p>
            <span className="font-semibold text-ink">🧮 ตัวอย่าง:</span> <span className="text-ink-soft">{entry.example}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FormulaSheetPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FormulaEntry | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FORMULAS;
    return FORMULAS.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.formula.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          รวมสูตรสำคัญ <span className="text-aurora">Formula Sheet</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          ทุกสูตรพร้อมความหมายตัวแปร หน่วย SI เงื่อนไขการใช้ ข้อจำกัด และตัวอย่างสั้น ๆ
        </p>
      </header>

      <div className="mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ค้นหาสูตร เช่น Bernoulli, Reynolds, ρgh…"
          className="w-full rounded-xl border border-line bg-surface-soft px-4 py-3 text-ink outline-none focus:border-flow-500 focus:ring-2 focus:ring-flow-500/30"
          aria-label="ค้นหาสูตร"
        />
        <p className="mt-2 text-xs text-ink-faint">พบ {filtered.length} สูตร</p>
      </div>

      {filtered.length === 0 ? (
        <p className="lab-card p-8 text-center text-sm text-ink-soft">
          ไม่พบสูตรที่ตรงกับ “{query}”
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((f) => {
            const hasCalc = Boolean(CALCS[f.formula]);
            return (
              <button
                key={f.formula}
                type="button"
                onClick={() => setSelected(f)}
                className="lab-card group flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:ring-aurora"
              >
                <h2 className="text-sm font-bold text-ink">{f.name}</h2>
                <div className="mt-2 rounded-lg bg-flow-500/10 px-3 py-2 font-mono text-base font-semibold text-flow-700 dark:text-flow-200">
                  {f.formula}
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-xs text-ink-soft">{f.whenToUse}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`lab-chip !text-[11px] ${
                      hasCalc ? "!border-flow-400/40 !text-flow-600 dark:!text-flow-300" : "!text-ink-faint"
                    }`}
                  >
                    {hasCalc ? "🧮 คำนวณได้" : "เชิงแนวคิด"}
                  </span>
                  <span className="text-xs font-semibold text-flow-600 transition group-hover:translate-x-0.5 dark:text-flow-300">
                    เปิด →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && <FormulaModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
