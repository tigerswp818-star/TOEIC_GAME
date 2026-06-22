import { useState } from "react";
import SimulationLayout from "@/components/sim/SimulationLayout";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { formatNumber } from "@/lib/math";
import { GRAVITY } from "@/lib/constants";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";

const RHO = 1000;
const CO2_PER_KWH = 0.5; // kg CO₂ per kWh (grid estimate)

interface UI {
  qH: number; // m³/h per pump
  tdh: number; // m
  etaPump: number; // %
  etaMotor: number; // %
  etaDrive: number; // %
  hours: number; // h/day
  tariff: number; // ฿/kWh
  pumps: number;
}
const DEFAULTS: UI = { qH: 200, tdh: 36, etaPump: 75, etaMotor: 92, etaDrive: 97, hours: 18, tariff: 4.2, pumps: 1 };

function compute(u: UI) {
  const qs = u.qH / 3600; // m³/s per pump
  const etaTotal = (u.etaPump / 100) * (u.etaMotor / 100) * (u.etaDrive / 100);
  const phPerPump = RHO * GRAVITY * qs * u.tdh; // W hydraulic per pump
  const pinPerPump = phPerPump / etaTotal; // W input per pump
  const pinTotalKW = (pinPerPump * u.pumps) / 1000;
  const phTotalKW = (phPerPump * u.pumps) / 1000;
  const totalQh = u.qH * u.pumps; // m³/h
  const kwhDay = pinTotalKW * u.hours;
  const kwhMonth = kwhDay * 30;
  const costMonth = kwhMonth * u.tariff;
  const sec = totalQh > 0 ? pinTotalKW / totalQh : 0; // kWh/m³
  const co2Month = kwhMonth * CO2_PER_KWH;
  return { etaTotal, phTotalKW, pinTotalKW, totalQh, kwhDay, kwhMonth, costMonth, sec, co2Month };
}

const guidedSteps: GuidedStep[] = [
  { title: "ดูที่มาของค่าไฟ", body: "ค่าไฟมาจาก กำลังไฟฟ้าเข้า × ชั่วโมง × ค่าไฟต่อหน่วย ส่วนกำลังไฟฟ้าเข้า = กำลังของไหล ÷ ประสิทธิภาพรวม", apply: { qH: 200, tdh: 36 } },
  { title: "ประสิทธิภาพรวมสำคัญมาก", body: "ลองลดประสิทธิภาพปั๊มลง (เช่น เดินไกล BEP) ค่าไฟพุ่งทันที เพราะ Pin = Ph / (η_p × η_m × η_d)", apply: { etaPump: 55 } },
  { title: "ลด head ลดพลังงาน", body: "ลด TDH (เช่น ใช้ท่อใหญ่ขึ้นลดการสูญเสีย) จะลดทั้งกำลังและ kWh/m³ โดยตรง", apply: { etaPump: 75, tdh: 28 } },
];

const challenges: Challenge[] = [
  { id: "sec", title: "ลดพลังงานจำเพาะให้ ≤ 0.10 kWh/m³", hint: "เพิ่มประสิทธิภาพ (η) หรือลด TDH — kWh/m³ = Pin/Q", isSolved: (r) => r.sec <= 0.1 && r.sec > 0, success: "เยี่ยม! พลังงานจำเพาะต่ำ = สถานีประหยัด" },
  { id: "cost", title: "ลดค่าไฟ/เดือนให้ต่ำกว่า 50,000 ฿ โดยคง flow ≥ 180 m³/h", hint: "เพิ่ม η, ลด TDH หรือลดชั่วโมงเดินที่ไม่จำเป็น", isSolved: (r) => r.costMonth < 50000 && r.totalQh >= 180, success: "ทำได้! คุม flow ตามต้องการพร้อมค่าไฟที่ต่ำลง" },
];

const quiz: QuizItem[] = [
  { question: "พลังงานจำเพาะ (kWh/m³) คืออะไร?", choices: ["พลังงานต่อปริมาตรน้ำที่จ่ายได้", "กำลังของปั๊ม", "ค่าไฟต่อเดือน", "ความดันของน้ำ"], answer: 0, explain: "kWh/m³ = พลังงานไฟฟ้าที่ใช้ ÷ ปริมาตรน้ำที่จ่ายได้ ยิ่งต่ำยิ่งประหยัด เป็นตัวชี้วัดหลักของสถานี" },
  { question: "ถ้าประสิทธิภาพรวมลดลง ค่าไฟจะ?", choices: ["ลดลง", "เพิ่มขึ้น", "เท่าเดิม", "เป็นศูนย์"], answer: 1, explain: "Pin = Ph / η_total เมื่อ η ลด Pin เพิ่ม → kWh และค่าไฟเพิ่ม" },
];

function Bar({ frac, color, label }: { frac: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] text-ink-soft">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-soft">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, frac * 100)}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">{formatNumber(frac * 100, 0)}%</span>
    </div>
  );
}

export default function EnergyCostSim() {
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const c = compute(u);

  const set = (key: keyof UI) => (v: number) => setU((prev) => ({ ...prev, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((prev) => ({ ...prev, ...vals }));

  const explanation = `สถานีจ่ายน้ำ ${formatNumber(c.totalQh, 0)} m³/h ใช้กำลังไฟฟ้า ${formatNumber(c.pinTotalKW)} kW → ${formatNumber(c.kwhDay, 0)} kWh/วัน · ค่าไฟ ${formatNumber(c.costMonth, 0)} ฿/เดือน · พลังงานจำเพาะ ${formatNumber(c.sec, 3)} kWh/m³ (ประสิทธิภาพรวม ${formatNumber(c.etaTotal * 100, 0)}%)`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ sec: c.sec, costMonth: c.costMonth, totalQh: c.totalQh }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ค่าไฟ/เดือน" value={c.costMonth} unit="฿" big decimals={0} accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="พลังงานจำเพาะ" value={c.sec} unit="kWh/m³" big decimals={3} accentClass="text-emerald-500" />
        <ResultStat label="กำลังไฟฟ้าเข้า" value={c.pinTotalKW} unit="kW" />
        <ResultStat label="พลังงาน/วัน" value={c.kwhDay} unit="kWh" decimals={0} />
        <ResultStat label="พลังงาน/เดือน" value={c.kwhMonth} unit="kWh" decimals={0} />
        <ResultStat label="CO₂/เดือน" value={c.co2Month} unit="kg" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: `η รวม ${formatNumber(c.etaTotal * 100, 0)}%`, tone: c.etaTotal > 0.6 ? "emerald" : "amber" }} />
    </>
  );

  return (
    <SimulationLayout
      title="เครื่องคิดพลังงานและค่าไฟ"
      titleEn="Energy Cost Calculator — kWh/m³ และค่าไฟสถานีสูบน้ำ"
      icon="⚡"
      controls={
        <div className="lab-card space-y-3.5 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="อัตราการไหล/ปั๊ม" symbol="Q" value={u.qH} min={20} max={500} step={5} unit="m³/h" decimals={0} onChange={set("qH")} />
          <ControlSlider label="เฮดรวม TDH" symbol="H" value={u.tdh} min={5} max={120} step={1} unit="m" decimals={0} onChange={set("tdh")} />
          <ControlSlider label="ประสิทธิภาพปั๊ม" symbol="η_p" value={u.etaPump} min={40} max={88} step={1} unit="%" decimals={0} onChange={set("etaPump")} />
          <ControlSlider label="ประสิทธิภาพมอเตอร์" symbol="η_m" value={u.etaMotor} min={80} max={97} step={1} unit="%" decimals={0} onChange={set("etaMotor")} />
          <ControlSlider label="ประสิทธิภาพไดร์ฟ" symbol="η_d" value={u.etaDrive} min={90} max={99} step={1} unit="%" decimals={0} onChange={set("etaDrive")} />
          <ControlSlider label="ชั่วโมงเดิน/วัน" symbol="t" value={u.hours} min={1} max={24} step={1} unit="h" decimals={0} onChange={set("hours")} />
          <ControlSlider label="ค่าไฟต่อหน่วย" symbol="฿" value={u.tariff} min={2} max={8} step={0.1} unit="฿/kWh" decimals={1} onChange={set("tariff")} />
          <ControlSlider label="จำนวนปั๊มที่เดิน" symbol="n" value={u.pumps} min={1} max={4} step={1} unit="ตัว" decimals={0} onChange={set("pumps")} />
        </div>
      }
      stage={
        <div className="group relative">
          <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-br from-flow-400/30 via-deep-500/10 to-iris-500/30 opacity-70 blur-lg" />
          <div className="lab-card relative flex aspect-[16/10] flex-col justify-center gap-5 overflow-hidden p-6 ring-1 ring-white/10">
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">ค่าไฟโดยประมาณ Estimated cost</div>
              <div className="mt-1 font-mono text-4xl font-extrabold text-ink sm:text-5xl">
                ฿{formatNumber(c.costMonth, 0)}<span className="text-lg text-ink-faint"> /เดือน</span>
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-500">{formatNumber(c.sec, 3)} kWh/m³</div>
            </div>
            <div className="mx-auto w-full max-w-md space-y-2">
              <div className="mb-1 text-center text-[11px] text-ink-faint">พลังงานไหลไปไหน (จากไฟฟ้าเข้า → น้ำที่ได้)</div>
              <Bar frac={c.etaTotal} color="bg-gradient-to-r from-emerald-400 to-cyan-500" label="งานมีประโยชน์ (น้ำ)" />
              <Bar frac={1 - c.etaTotal} color="bg-gradient-to-r from-amber-400 to-rose-500" label="สูญเสีย (ปั๊ม/มอเตอร์/ไดร์ฟ)" />
            </div>
            <div className="text-center text-[11px] text-ink-faint">
              {formatNumber(c.totalQh, 0)} m³/h · {formatNumber(c.pinTotalKW)} kW · {u.pumps} ปั๊ม · {u.hours} ชม./วัน
            </div>
          </div>
        </div>
      }
      results={results}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
