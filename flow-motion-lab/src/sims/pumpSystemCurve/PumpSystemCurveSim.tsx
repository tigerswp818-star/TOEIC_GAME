import { useState } from "react";
import SimulationLayout from "@/components/sim/SimulationLayout";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { LineChart } from "@/components/sim/GraphPanel";
import { formatNumber } from "@/lib/math";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  solveOperating,
  pumpCurvePoints,
  systemCurvePoints,
  RATED,
  type PumpSysParams,
} from "./pumpSystemModel";

interface UI {
  speedPct: number;
  staticHead: number;
  length: number;
  diameterMm: number;
  valvePct: number;
  friction: number;
}
const DEFAULTS: UI = { speedPct: 100, staticHead: 20, length: 200, diameterMm: 150, valvePct: 100, friction: 0.02 };

const X_MAX_S = RATED.Qmax * 1.15; // m³/s domain
const X_MAX_H = X_MAX_S * 3600; // m³/h domain
const Y_MAX = 80; // m

const toParams = (u: UI): PumpSysParams => ({
  speed: u.speedPct / 100,
  staticHead: u.staticHead,
  length: u.length,
  diameter: u.diameterMm,
  valve: u.valvePct / 100,
  friction: u.friction,
});

const guidedSteps: GuidedStep[] = [
  {
    title: "จุดทำงานคือจุดตัดของสองเส้น",
    body: "ปั๊มจะทำงานที่ 'จุดตัด' ระหว่าง Pump Curve (สีฟ้า ความสามารถของปั๊ม) กับ System Curve (สีส้ม ความต้องการของระบบ) เสมอ — ไม่ใช่ที่จุดใดก็ได้",
    apply: { speedPct: 100, valvePct: 100, staticHead: 20 },
  },
  {
    title: "หรี่วาล์ว → System Curve ชันขึ้น",
    body: "ลดการเปิดวาล์วลง สังเกตว่าเส้นระบบ (ส้ม) ชันขึ้น จุดทำงานเลื่อนไปทางซ้าย flow ลดลง แต่พลังงานส่วนเกินถูกทิ้งไปที่วาล์ว (สิ้นเปลือง)",
    apply: { valvePct: 45 },
  },
  {
    title: "ลดรอบ VFD → Pump Curve ต่ำลง",
    body: "เปิดวาล์วเต็มแล้วลดรอบปั๊ม (VFD) แทน เส้นปั๊ม (ฟ้า) จะยุบต่ำลง flow ลดเช่นกัน แต่กำลังลดแบบกำลังสามตาม affinity law — ประหยัดกว่าการหรี่วาล์วมาก",
    apply: { valvePct: 100, speedPct: 75 },
  },
  {
    title: "ทำงานใกล้ BEP",
    body: "พยายามให้จุดทำงานอยู่ใกล้จุด BEP (จุดเขียว) ปั๊มจะมีประสิทธิภาพสูงสุดและสึกหรอน้อยที่สุด การเดินไกลจาก BEP ทำให้ประสิทธิภาพตกและสั่นสะเทือน",
  },
];

const challenges: Challenge[] = [
  {
    id: "bep",
    title: "ปรับให้ปั๊มทำงานใกล้ BEP (|ระยะจาก BEP| < 8%)",
    hint: "ปรับรอบ VFD และการเปิดวาล์วให้จุดทำงาน (ม่วง) เข้าใกล้จุด BEP (เขียว)",
    isSolved: (r) => Math.abs(r.bepDist) < 8,
    success: "เยี่ยม! ปั๊มทำงานใกล้ BEP ประสิทธิภาพสูงสุดและสึกหรอน้อย",
  },
  {
    id: "target",
    title: "จ่ายน้ำให้ได้ Q ≥ 180 m³/h ด้วยรอบ VFD (วาล์วเปิดเต็ม)",
    hint: "เปิดวาล์ว 100% แล้วเพิ่มรอบ VFD — flow ∝ รอบ",
    isSolved: (r) => r.Qh >= 180 && r.valve >= 0.95,
    success: "สำเร็จ! เพิ่ม flow ด้วย VFD โดยไม่ทิ้งพลังงานที่วาล์ว",
  },
  {
    id: "save",
    title: "ลด flow เหลือ ~120 m³/h แต่ใช้กำลังน้อยกว่า 12 kW (ใช้ VFD ไม่ใช่หรี่วาล์ว)",
    hint: "หรี่วาล์วจะกินกำลังมากกว่า ลองลดรอบ VFD แทนเพื่อให้กำลังต่ำ",
    isSolved: (r) => r.Qh >= 105 && r.Qh <= 135 && r.kW < 12,
    success: "ใช่เลย! VFD ลดกำลังแบบกำลังสามจึงประหยัดกว่าการหรี่วาล์ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ปั๊มหอยโข่งจะทำงานที่จุดใด?",
    choices: ["จุดสูงสุดของ Pump Curve", "จุดตัดระหว่าง Pump Curve กับ System Curve", "จุด BEP เสมอ", "จุดที่ flow มากที่สุด"],
    answer: 1,
    explain: "ปั๊มทำงานที่จุดสมดุลซึ่งหัวที่ปั๊มสร้างได้ = หัวที่ระบบต้องการ นั่นคือจุดตัดของสองเส้นเสมอ",
  },
  {
    question: "การหรี่วาล์ว (throttling) เพื่อลด flow มีผลอย่างไรต่อพลังงาน?",
    choices: ["ประหยัดพลังงานมากที่สุด", "ไม่มีผลต่อพลังงาน", "สิ้นเปลืองเพราะทิ้งพลังงานที่วาล์ว", "ทำให้ปั๊มพังทันที"],
    answer: 2,
    explain: "การหรี่วาล์วทำให้ System Curve ชันขึ้น จุดทำงานเลื่อนแต่ปั๊มยังหมุนเต็มรอบ พลังงานส่วนเกินสูญเสียที่วาล์ว",
  },
  {
    question: "ตาม Affinity Law เมื่อลดรอบปั๊มลง 20% (เหลือ 80%) กำลังจะเป็นเท่าใดโดยประมาณ?",
    choices: ["80%", "64%", "51%", "20%"],
    answer: 2,
    explain: "กำลัง ∝ รอบกำลังสาม → 0.8³ ≈ 0.51 หรือราว 51% นี่คือเหตุผลที่ VFD ประหยัดพลังงานมาก",
  },
];

export default function PumpSystemCurveSim() {
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const p = toParams(u);
  const r = solveOperating(p);

  const set = (key: keyof UI) => (v: number) => setU((prev) => ({ ...prev, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((prev) => ({ ...prev, ...vals }));

  const Qh = r.Qop * 3600; // m³/h
  const kW = r.shaftPowerW / 1000;
  const etaPct = r.eta * 100;

  // Curve point sets (x in m³/h, y in m, clipped to the plot domain).
  const toH = (pts: { x: number; y: number }[]) =>
    pts.map((pt) => ({ x: pt.x * 3600, y: pt.y })).filter((pt) => pt.y >= 0 && pt.y <= Y_MAX);
  const pumpPts = toH(pumpCurvePoints(p.speed, X_MAX_S));
  const ratedPts = toH(pumpCurvePoints(1, X_MAX_S));
  const sysPts = toH(systemCurvePoints(p, X_MAX_S));
  const Hbep = RATED.H0 * p.speed * p.speed - (RATED.H0 / (RATED.Qmax * RATED.Qmax)) * r.Qbep * r.Qbep;

  const farFromBep = Math.abs(r.bepDistPct) > 25;

  const explanation = r.shutoff
    ? `ปั๊มสร้างหัวได้ไม่พอเอาชนะเฮดสถิต ${formatNumber(u.staticHead)} m ที่รอบนี้ — flow = 0 (shut-off) ลองเพิ่มรอบ VFD หรือลดเฮดสถิต`
    : `ปั๊มทำงานที่จุดตัดของสองเส้น: ได้ flow ${formatNumber(Qh, 0)} m³/h ที่หัว ${formatNumber(r.Hop)} m · ประสิทธิภาพ ${formatNumber(etaPct, 0)}%` +
      (farFromBep
        ? ` ⚠️ จุดทำงานอยู่ห่างจาก BEP ${formatNumber(r.bepDistPct, 0)}% — ประสิทธิภาพต่ำและเสี่ยงสั่นสะเทือน`
        : ` ✓ อยู่ใกล้ BEP (ห่าง ${formatNumber(r.bepDistPct, 0)}%) ทำงานคุ้มค่า`);

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ bepDist: r.bepDistPct, Qh, kW, valve: p.valve }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="อัตราการไหล Q" value={Qh} unit="m³/h" big decimals={0} accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="หัวที่จุดทำงาน H" value={r.Hop} unit="m" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="ประสิทธิภาพปั๊ม η" value={etaPct} unit="%" decimals={0} />
        <ResultStat label="กำลังเพลา P" value={kW} unit="kW" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ระยะจาก BEP" value={r.bepDistPct} unit="%" decimals={0} accentClass={farFromBep ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="พลังงานจำเพาะ" value={r.Qop > 0 ? kW / Qh : 0} unit="kWh/m³" decimals={3} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: r.shutoff ? "Shut-off" : farFromBep ? "ไกล BEP" : "ใกล้ BEP",
          tone: r.shutoff ? "rose" : farFromBep ? "amber" : "emerald",
        }}
      />

      {mode !== "challenge" && (
        <section className="rounded-xl border border-flow-500/30 bg-gradient-to-br from-flow-500/[0.08] to-iris-500/[0.06] p-3.5">
          <h3 className="text-sm font-bold text-flow-700 dark:text-flow-200">💡 จุดทำงาน Operating Point</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            ปั๊มจะทำงานที่จุดตัดระหว่าง <span className="font-semibold text-flow-600 dark:text-flow-300">Pump Curve</span> (ความสามารถของปั๊ม) กับ{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-300">System Curve</span> (ความต้องการของระบบ) — หรี่วาล์วทำให้เส้นระบบชันขึ้น ส่วน VFD ทำให้เส้นปั๊มยุบลง
          </p>
        </section>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="กราฟปั๊มและกราฟระบบ"
      titleEn="Pump Curve vs System Curve — หาจุดทำงาน (Operating Point)"
      icon="📈"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="รอบปั๊ม (VFD)" symbol="N" value={u.speedPct} min={40} max={110} step={1} unit="%" decimals={0} onChange={set("speedPct")} />
          <ControlSlider label="การเปิดวาล์ว" symbol="valve" value={u.valvePct} min={10} max={100} step={1} unit="%" decimals={0} onChange={set("valvePct")} />
          <ControlSlider label="เฮดสถิต" symbol="h_s" value={u.staticHead} min={0} max={45} step={1} unit="m" decimals={0} onChange={set("staticHead")} />
          <ControlSlider label="ความยาวท่อ" symbol="L" value={u.length} min={50} max={800} step={10} unit="m" decimals={0} onChange={set("length")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ" symbol="D" value={u.diameterMm} min={80} max={300} step={5} unit="mm" decimals={0} onChange={set("diameterMm")} />
          <ControlSlider label="แฟกเตอร์เสียดทาน" symbol="f" value={u.friction} min={0.01} max={0.04} step={0.001} unit="—" decimals={3} onChange={set("friction")} />
        </div>
      }
      stage={
        <div className="group relative">
          <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-br from-flow-400/30 via-deep-500/10 to-iris-500/30 opacity-70 blur-lg" />
          <div className="lab-card relative overflow-hidden p-4 ring-1 ring-white/10">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#22d3ee]" /> Pump curve</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-[#f59e0b]" /> System curve</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa]" /> จุดทำงาน</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> BEP</span>
            </div>
            <LineChart
              series={[
                { points: ratedPts, color: "#64748b", dashed: true, label: "rated" },
                { points: pumpPts, color: "#22d3ee", label: "pump" },
                { points: sysPts, color: "#f59e0b", label: "system" },
              ]}
              xLabel="อัตราการไหล Q (m³/h)"
              yLabel="หัว H (m)"
              domain={{ xMin: 0, xMax: X_MAX_H, yMin: 0, yMax: Y_MAX }}
              markers={[
                ...(r.shutoff ? [] : [{ x: Qh, y: r.Hop, color: "#a78bfa", label: "OP" }]),
                ...(Hbep > 0 && Hbep <= Y_MAX ? [{ x: r.Qbep * 3600, y: Hbep, color: "#10b981", label: "BEP" }] : []),
              ]}
            />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              ● จุดม่วง = จุดทำงาน (ปั๊มทำงานตรงนี้) · ● จุดเขียว = BEP (ประสิทธิภาพสูงสุด)
            </p>
          </div>
        </div>
      }
      results={results}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
