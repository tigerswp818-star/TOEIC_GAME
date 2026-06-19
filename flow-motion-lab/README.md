# 🌊 Flow Motion Lab: Complete Interactive Fluid Mechanics

> หลักสูตร Fluid Mechanics **15 บท · 3 ระดับ** (พื้นฐาน → วิศวกรรม → ขั้นสูง) พร้อม
> **simulation 48 ตัว** ที่เห็นการไหลจริง (ครบทุกบท), แผนที่การเรียน + เส้นทางการเรียน (Learning Path),
> ระบบติดตามความก้าวหน้า (Progress), Mini Quiz, Challenge, Formula Sheet,
> Unit Converter และ Glossary — เห็นการเคลื่อนที่ก่อน แล้วจึงเชื่อมกับสูตร

## เดิม: เห็นการไหล เข้าใจของไหล

เว็บไซต์ **interactive** สำหรับเรียน **Fluid Mechanics** แบบ "เห็นภาพการเคลื่อนที่ของของไหล"
ไม่ได้มีแค่สูตร แต่ทำให้ผู้เรียน **เห็น** หลักการผ่าน simulation และ animation แบบ real-time —
อนุภาคของไหล (Particles) เส้นการไหล (Streamline) ลูกศรความเร็ว (Velocity Vector)
และสีความดัน (Pressure Color Map) ที่เปลี่ยนทันทีเมื่อปรับค่า input

> A visual-first, Thai-language Fluid Mechanics learning lab. Every topic has a live
> canvas animation at the centre of the screen; adjust a slider and the flow responds
> instantly. No backend — all physics is computed client-side.

## ✨ คุณสมบัติ

- **Visual-first** — ทุก simulation มีภาพเคลื่อนไหวจริง (canvas + `requestAnimationFrame`) ไม่ใช่รูปนิ่ง
- **ปรับแล้วเห็นผลทันที** — slider / numeric input เปลี่ยน → animation, กราฟ, ผลลัพธ์อัปเดต real-time
- **ระบบควบคุม** — Play / Pause / Reset / Slow-motion + ความเร็ว ×0.25 ×0.5 ×1 ×2
- **Toggle ชั้นการมองเห็น** — อนุภาค / streamline / velocity vector / pressure color / กราฟ / สูตร
- **panel "ตอนนี้เกิดอะไรขึ้น?"** — คำอธิบายภาษาไทยที่เปลี่ยนตามค่าที่ปรับ
- **3 โหมดการเรียน** — สำรวจอิสระ (Explore) · เรียนทีละขั้น (Guided) · โจทย์ท้าทาย (Challenge)
- **Mini Quiz** เฉลยทันทีพร้อมเหตุผล, **Formula Sheet**, และหน้า **เห็นในชีวิตจริง**
- **Responsive** มือถือ/แท็บเล็ต/เดสก์ท็อป + **Dark / Light mode**

## 🧪 Simulation (พร้อมใช้ทั้ง 8 หัวข้อ)

| หัวข้อ | สูตรหลัก | สิ่งที่ได้เห็น |
|--------|----------|----------------|
| สมการความต่อเนื่อง Continuity | `A₁V₁ = A₂V₂` | อนุภาคเร่งเร็วในคอท่อ + ตัวนับการไหลผ่านหน้าตัด |
| เบอร์นูลลี / เวนทูรี Bernoulli / Venturi | `P/ρg + V²/2g + z = const` | แผนที่สีความดัน + มาโนมิเตอร์ 3 หลอด |
| เลขเรย์โนลด์ Reynolds Number | `Re = ρVD/μ` | Laminar → Turbulent + eddies/vortices |
| แรงลอยตัว Buoyancy | `Fb = ρgV` | วัตถุลอย/จม/สมดุล + ลูกศรแรง Fb vs W |
| ความดันของของไหล Hydrostatic Pressure | `P = ρgh` | สีตามความลึก + ลูกศรแรงดันผนัง + เกจหมุน |
| การสูญเสียในท่อ Pipe Head Loss | `hf = f(L/D)(V²/2g)` | เส้นพลังงาน (EGL) ลดลง + step ที่วาล์ว/ข้องอ |
| การหมุนวน Vortex | `v = ω·r` | Rankine vortex มุมมองด้านบน + โปรไฟล์ vθ–r |
| การไหลผ่านวัตถุ Flow Around Object | `Cp = 1 − (v/U)²` | streamline อ้อมวัตถุ + wake + pressure map |

## 🛠️ Tech stack

React 18 · TypeScript (strict) · Tailwind CSS · Vite · HTML5 Canvas · `requestAnimationFrame`
ไม่มี backend, ไม่มี dependency เกินจำเป็น (มีเพียง `react-router-dom`)

## 🚀 เริ่มใช้งาน

```bash
cd flow-motion-lab
npm install
npm run dev      # เปิด dev server
npm run build    # type-check + build production (output: dist/)
npm run preview  # ดูผล build
```

## 🧱 โครงสร้างโค้ด

```
src/
  components/
    canvas/ParticleFlowCanvas.tsx   # canvas host + RAF draw loop (high-DPI)
    sim/                            # SimulationLayout, SimStage, SimulationControls,
                                    # ControlSlider, ResultStat, FormulaCard,
                                    # ExplanationPanel, GraphPanel (Line/Bar),
                                    # ModeTabs, GuidedSteps, ChallengePanel,
                                    # MiniQuiz, MiniPreview, PressureLegend, ToggleChip
  hooks/        useRaf · useSimControls · useTheme (context)
  lib/          constants · math · colors · fluidFormulas · render/draw
  sims/         registry.ts + continuity/ bernoulli/ reynolds/ buoyancy/
                  hydrostatic/ headloss/ vortex/ flowAround/
                  (แต่ละโฟลเดอร์: <Name>Model.ts, <Name>Sim.tsx, <Name>Preview.tsx)
  pages/        Landing · Dashboard · Simulation · FormulaSheet · RealWorld · NotFound
  types/        simulation.ts
```

### เพิ่ม simulation ใหม่

1. สร้างโฟลเดอร์ `src/sims/<id>/` พร้อม `Model.ts`, `Sim.tsx`, `Preview.tsx`
2. ใช้ `ParticleFlowCanvas` + `SimStage` + `SimulationLayout` + `useSimControls`
3. เพิ่ม entry ใน `src/sims/registry.ts` — เท่านี้ dashboard และ router ก็เห็นทันที

> หมายเหตุการ map ชื่อ component ตามโจทย์: `ParticleFlowCanvas` = canvas host,
> velocity vectors/streamlines/pressure ทำผ่าน helper ใน `lib/render/draw.ts`
> และ `lib/colors.ts` (`drawVelocityVector`, `drawStreamline`, `pressureColor`)
> ส่วน legend อยู่ที่ `PressureLegend`.

## 📐 ความถูกต้องของฟิสิกส์

สูตรทั้งหมดอยู่ใน `src/lib/fluidFormulas.ts` (SI units) พร้อมป้องกันค่าที่ไม่สมเหตุสมผล
(หาร 0 / ค่าติดลบ) ค่าคงที่ `g = 9.81`, `ρ_water = 1000` อยู่ใน `src/lib/constants.ts`
