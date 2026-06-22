import { useState } from "react";
import ControlSlider from "@/components/sim/ControlSlider";
import { formatNumber, clamp } from "@/lib/math";
import { GRAVITY } from "@/lib/constants";
import { pumpEfficiency, RATED } from "../pumpSystemCurve/pumpSystemModel";

const RHO = 1000;
const QBEP_H = RATED.Qbep * 3600; // ≈ 198 m³/h per pump at BEP
const STATIC = 20;
const KSYS = 1300; // system resistance (head = STATIC + KSYS·Q_s²)

interface PlanForK {
  k: number;
  perPumpH: number; // m³/h
  pctBep: number;
  eta: number;
  powerKW: number;
  feasible: boolean;
}

function planFor(demandH: number, k: number, vfd: boolean): PlanForK {
  const perPumpH = demandH / k;
  const pctBep = perPumpH / QBEP_H;
  const Ds = demandH / 3600;
  const H = STATIC + KSYS * Ds * Ds;
  const etaFixed = pumpEfficiency(perPumpH / 3600, 1);
  // VFD trims running pumps toward BEP → near-peak efficiency, wider feasible range.
  const eta = vfd ? Math.max(etaFixed, RATED.etaMax * 0.97) : etaFixed;
  const powerKW = (RHO * GRAVITY * Ds * H) / eta / 1000;
  const feasible = vfd ? pctBep >= 0.25 && pctBep <= 1.4 : pctBep >= 0.4 && pctBep <= 1.45;
  return { k, perPumpH, pctBep, eta, powerKW, feasible };
}

export default function MultiPumpSim() {
  const [demand, setDemand] = useState(400);
  const [available, setAvailable] = useState(3);
  const [running, setRunning] = useState(2);
  const [vfd, setVfd] = useState(true);

  const runK = clamp(running, 1, available);
  const plans = Array.from({ length: available }, (_, i) => planFor(demand, i + 1, vfd));
  const feasiblePlans = plans.filter((p) => p.feasible);
  const recommend = (feasiblePlans.length ? feasiblePlans : plans).reduce((best, p) => (p.powerKW < best.powerKW ? p : best));
  const chosen = plans[runK - 1];

  const kWhm3 = demand > 0 ? chosen.powerKW / demand : 0;
  const optimal = runK === recommend.k;

  let warning = "";
  if (!chosen.feasible) {
    warning = chosen.pctBep > 1.4
      ? `เดิน ${runK} ตัวน้อยเกินไป — แต่ละปั๊มต้องจ่าย ${formatNumber(chosen.perPumpH, 0)} m³/h (${formatNumber(chosen.pctBep * 100, 0)}% BEP) เสี่ยง run-out/overload`
      : `เดิน ${runK} ตัวมากเกินไป — แต่ละปั๊ม flow ต่ำ (${formatNumber(chosen.pctBep * 100, 0)}% BEP) ประสิทธิภาพตก/เสี่ยง recirculation`;
  } else if (!optimal) {
    warning = `เดินได้ แต่ยังไม่คุ้มสุด — ควรเดิน ${recommend.k} ตัว (กำลังต่ำกว่า ${formatNumber(chosen.powerKW - recommend.powerKW)} kW)`;
  }

  const roleOf = (idx: number): { label: string; tone: string; spinning: boolean } => {
    if (idx >= runK) return { label: "Standby", tone: "text-ink-faint border-line bg-surface-soft", spinning: false };
    if (vfd && idx === runK - 1) return { label: "VFD assist", tone: "text-iris-600 dark:text-iris-300 border-iris-400/50 bg-iris-500/10", spinning: true };
    return { label: "Duty", tone: "text-emerald-600 dark:text-emerald-300 border-emerald-400/50 bg-emerald-500/10", spinning: true };
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-deep-500 to-iris-600 text-2xl shadow-glow ring-1 ring-white/15">🔢</span>
        <div>
          <h1 className="bg-gradient-to-r from-ink to-ink-soft bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl dark:from-white dark:to-ink-soft">
            จัดปั๊มหลายตัวให้คุ้มพลังงาน
          </h1>
          <p className="font-mono text-xs text-flow-600 dark:text-flow-300/80">Multi-Pump Optimizer — เดินกี่ตัวให้ใกล้ BEP และประหยัดที่สุด</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* controls */}
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความต้องการใช้น้ำ" symbol="Q" value={demand} min={80} max={760} step={10} unit="m³/h" decimals={0} onChange={(v) => setDemand(v)} />
          <ControlSlider label="ปั๊มที่มีทั้งหมด" symbol="N" value={available} min={2} max={4} step={1} unit="ตัว" decimals={0} onChange={(v) => { setAvailable(v); if (running > v) setRunning(v); }} />
          <ControlSlider label="ปั๊มที่เดิน" symbol="k" value={runK} min={1} max={available} step={1} unit="ตัว" decimals={0} onChange={(v) => setRunning(v)} />
          <button
            type="button"
            onClick={() => setVfd((v) => !v)}
            className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition ${vfd ? "bg-gradient-to-r from-flow-500 to-iris-500 text-white shadow-glow" : "border border-line bg-surface-soft text-ink-soft"}`}
          >
            VFD: {vfd ? "เปิด (ปรับรอบให้ใกล้ BEP)" : "ปิด (รอบคงที่)"}
          </button>
          <p className="text-[11px] text-ink-faint">ปั๊มแต่ละตัว BEP ≈ {formatNumber(QBEP_H, 0)} m³/h · เดินใกล้ BEP = ประสิทธิภาพสูงสุด</p>
        </div>

        {/* visual + results */}
        <div className="space-y-4">
          {/* pump row */}
          <div className="lab-card p-4">
            <div className="flex flex-wrap items-end justify-center gap-4">
              {Array.from({ length: available }, (_, i) => {
                const role = roleOf(i);
                const isRun = i < runK;
                return (
                  <div key={i} className={`flex w-24 flex-col items-center gap-1.5 rounded-xl border p-3 ${role.tone}`}>
                    <span className={`text-3xl ${role.spinning ? "animate-spin [animation-duration:3s]" : "opacity-50"}`}>⚙️</span>
                    <span className="text-xs font-bold">ปั๊ม {i + 1}</span>
                    <span className="text-[10px] font-semibold">{role.label}</span>
                    <span className="font-mono text-[11px] text-ink">{isRun ? `${formatNumber(chosen.perPumpH, 0)} m³/h` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* key results */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="lab-card p-3"><div className="text-[11px] text-ink-faint">ควรเดิน</div><div className="font-mono text-2xl font-bold text-flow-600 dark:text-flow-300">{recommend.k} ตัว</div></div>
            <div className="lab-card p-3"><div className="text-[11px] text-ink-faint">ต่อปั๊ม (%BEP)</div><div className={`font-mono text-2xl font-bold ${chosen.feasible ? "text-emerald-500" : "text-rose-500"}`}>{formatNumber(chosen.pctBep * 100, 0)}%</div></div>
            <div className="lab-card p-3"><div className="text-[11px] text-ink-faint">กำลังรวม</div><div className="font-mono text-2xl font-bold text-ink">{formatNumber(chosen.powerKW)} <span className="text-xs">kW</span></div></div>
            <div className="lab-card p-3"><div className="text-[11px] text-ink-faint">พลังงานจำเพาะ</div><div className="font-mono text-2xl font-bold text-ink">{formatNumber(kWhm3, 3)}</div><div className="text-[10px] text-ink-faint">kWh/m³</div></div>
          </div>

          {/* verdict */}
          <div className={`rounded-xl border p-3.5 ${optimal && chosen.feasible ? "border-emerald-400/50 bg-emerald-500/10" : "border-amber-400/50 bg-amber-500/10"}`}>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span>{optimal && chosen.feasible ? "✅" : "⚠️"}</span>
              <span className={optimal && chosen.feasible ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}>
                {optimal && chosen.feasible ? `เดิน ${runK} ตัว เหมาะสมแล้ว` : "ยังไม่เหมาะสมที่สุด"}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              {warning || `แต่ละปั๊มจ่าย ${formatNumber(chosen.perPumpH, 0)} m³/h (${formatNumber(chosen.pctBep * 100, 0)}% BEP) ประสิทธิภาพ ${formatNumber(chosen.eta * 100, 0)}% — ทำงานคุ้มค่าใกล้ BEP`}
              {vfd ? " · VFD ช่วยปรับรอบให้ปั๊มตัวสุดท้ายจ่ายพอดีความต้องการ ไม่ทิ้งพลังงานที่วาล์ว" : " · รอบคงที่ ปรับ flow ได้เป็นขั้นตามจำนวนปั๊ม"}
            </p>
          </div>

          <section className="lab-card relative overflow-hidden p-4 pl-5">
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-flow-400 to-iris-500" />
            <h2 className="text-sm font-bold text-ink">💡 หลักการจัดปั๊ม (Duty / Assist / Standby)</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              เดินปั๊มจำนวนที่ทำให้ <b>แต่ละตัวอยู่ใกล้ BEP</b> จะประหยัดและสึกหรอน้อยที่สุด — เดินน้อยตัวเกินไปแต่ละตัวจะ run-out (กระแสสูง) เดินมากเกินไปแต่ละตัว flow ต่ำ (ประสิทธิภาพตก) ปั๊ม Standby สำรองไว้สลับใช้เพื่อยืดอายุ
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
