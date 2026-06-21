import { useMemo, useState } from "react";

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
];

export default function FormulaSheetPage() {
  const [query, setQuery] = useState("");

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
          {filtered.map((f) => (
          <article key={f.formula} className="lab-card p-5">
            <h2 className="text-sm font-bold text-ink">{f.name}</h2>
            <div className="mt-2 rounded-lg bg-flow-500/10 px-3 py-2 font-mono text-base font-semibold text-flow-700 dark:text-flow-200">
              {f.formula}
            </div>
            <dl className="mt-3 space-y-1 text-xs">
              {f.vars.map((v) => (
                <div key={v.symbol} className="flex gap-2">
                  <dt className="w-16 shrink-0 font-mono font-semibold text-flow-600 dark:text-flow-300">
                    {v.symbol}
                  </dt>
                  <dd className="text-ink-soft">
                    {v.meaning} <span className="text-ink-faint">({v.unit})</span>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 space-y-1.5 text-xs">
              <p>
                <span className="font-semibold text-ink">📌 ใช้เมื่อ:</span>{" "}
                <span className="text-ink-soft">{f.whenToUse}</span>
              </p>
              <p>
                <span className="font-semibold text-ink">⚠️ ข้อจำกัด:</span>{" "}
                <span className="text-ink-soft">{f.limits}</span>
              </p>
              <p>
                <span className="font-semibold text-ink">🧮 ตัวอย่าง:</span>{" "}
                <span className="text-ink-soft">{f.example}</span>
              </p>
            </div>
          </article>
          ))}
        </div>
      )}
    </div>
  );
}
