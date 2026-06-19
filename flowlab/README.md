# 🌊 FlowLab — Interactive Fluid Mechanics

เว็บไซต์เรียนรู้ **กลศาสตร์ของไหล (Fluid Mechanics)** แบบ interactive ภาษาไทย
สำหรับนักเรียน ม.ปลายสายวิทย์ และนักศึกษาวิศวกรรมปี 1–2 ปรับค่าผ่าน slider แล้ว
เห็นผลลัพธ์ สูตร หน่วย และ animation แบบ real-time

> เรียน Fluid Mechanics แบบเห็นภาพ — ไม่ใช่แค่ท่องสูตร

## ✨ ฟีเจอร์

- **8 บทเรียน** ตั้งแต่พื้นฐานของไหลถึง momentum equation แต่ละบทมี concept,
  สูตร, simulator, ตัวอย่างคำนวณ, mini quiz และ key takeaway
- **6 simulator หลัก** (+ อีก 2 บทเสริม) คำนวณฝั่ง client ทั้งหมด:
  - Hydrostatic Pressure (P = ρgh) — ถังน้ำ + เกจ + กราฟ Pressure–Depth
  - Buoyancy — ลอย/จม/ลอยกลางน้ำ พร้อมลูกศรแรง
  - Continuity (A₁V₁ = A₂V₂) — particle animation ในท่อแคบ-กว้าง
  - Bernoulli + Venturi — energy head bar + ท่อ Venturi
  - Reynolds Number — animation laminar → transitional → turbulent
  - Pipe Loss (Darcy–Weisbach) — major/minor loss + กราฟ V²
- **Formula Sheet** รวมสูตร พร้อมตัวแปร หน่วย SI ตัวอย่าง และข้อควรระวัง
- **Unit Converter** — ความดัน ความยาว อัตราการไหล ความหนาแน่น ความหนืด ความเร็ว
- **Quiz Mode** — MCQ / True-False / เติมตัวเลข มี feedback ทันที + เก็บคะแนนใน
  `localStorage`
- **Real-world Examples** + **Glossary** + tooltip ศัพท์ยาก
- **Dark / Light mode** (จำค่าไว้) และ **responsive** (mobile-first)
- เก็บความคืบหน้าการเรียนใน `localStorage`

## 🛠 Tech Stack

React 18 + TypeScript · Vite · Tailwind CSS 3 · React Router (HashRouter) ·
SVG + `requestAnimationFrame` สำหรับ animation · **ไม่มี backend**

## 🚀 การใช้งาน

```bash
cd flowlab
npm install      # ติดตั้ง dependencies
npm run dev      # เปิด dev server (http://localhost:5173)
npm run build    # type-check + build เป็น static site ใน dist/
npm run preview  # ดูผล build
npm run typecheck
```

> `vite.config.ts` ตั้ง `base: "./"` (asset paths แบบ relative) ร่วมกับ HashRouter
> ทำให้ build ใน `dist/` ใช้งานได้ทันทีบน static host ใด ๆ รวมถึง GitHub Pages
> sub-path โดยไม่ต้องตั้งค่า server เพิ่ม

## 📁 โครงสร้างโปรเจกต์

```
src/
  constants/physics.ts      ค่าคงที่ (g, ρ_water) + ของไหล/วัสดุ preset
  types/index.ts            TypeScript types ของค่าทางฟิสิกส์/บทเรียน/quiz
  utils/
    physics.ts              ฟังก์ชันคำนวณบริสุทธิ์ (calculatePressure, ...)
    units.ts                ตารางแปลงหน่วย + convertUnit()
    format.ts, storage.ts   จัดรูปตัวเลข / localStorage แบบกันพัง
  context/                  ThemeContext (dark/light) + ProgressContext
  data/                     lessons, lessonContent, formulas, glossary,
                            quizzes, examples (เพิ่มบทใหม่ได้ง่าย)
  components/
    ui/                     Card, SliderInput, Badge, Button, Tabs, Tooltip, ...
    charts/                 LineChart, BarChart (SVG, ไม่มี dependency)
    layout/                 Layout, Sidebar, ThemeToggle
    lesson/                 QuizRunner, Term (glossary tooltip)
    simulators/             8 simulator
  pages/                    Landing, Dashboard, Lesson, FormulaSheet,
                            UnitConverter, Quiz, Examples, Glossary
  App.tsx, main.tsx, index.css
```

## ➕ เพิ่มบทเรียนใหม่

1. เพิ่ม object ใน `src/data/lessons.ts`
2. เพิ่มเนื้อหา + simulator ใน `src/data/lessonContent.tsx`
3. (ถ้ามี) เพิ่มสูตรใน `formulas.ts` และคำถามใน `quizzes.ts`

ระบบ route `/lesson/:id` จะ render บทใหม่ให้อัตโนมัติ

## 📐 ความถูกต้องทางวิศวกรรม

ใช้สมการ incompressible flow เป็นหลัก และระบุ **สมมติฐาน** ทุกบท เช่น Bernoulli
ใช้ได้เฉพาะ steady / incompressible / inviscid ตาม streamline เดียวกัน — มีคำเตือน
ไม่ให้เข้าใจผิดว่าใช้ได้ทุกกรณี ทุกผลลัพธ์แสดงหน่วย และ validate input
(เช่น เส้นผ่านศูนย์กลาง/พื้นที่/ความหนืดต้อง > 0)
