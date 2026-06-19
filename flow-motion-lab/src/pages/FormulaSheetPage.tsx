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
];

export default function FormulaSheetPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          รวมสูตรสำคัญ <span className="text-flow-500">Formula Sheet</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          ทุกสูตรพร้อมความหมายตัวแปร หน่วย SI เงื่อนไขการใช้ ข้อจำกัด และตัวอย่างสั้น ๆ
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {FORMULAS.map((f) => (
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
    </div>
  );
}
