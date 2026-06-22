import { useState } from "react";
import { LineChart } from "@/components/sim/GraphPanel";
import { clamp } from "@/lib/math";

interface Method {
  id: string;
  label: string;
  iStart: number; // × full-load current
  tStart: number; // × rated torque
  stress: string;
  smooth: number; // 1..5
  color: string;
  note: string;
}

const METHODS: Method[] = [
  { id: "dol", label: "DOL (ต่อตรง)", iStart: 6.5, tStart: 1.6, stress: "สูงมาก", smooth: 1, color: "#ef4444", note: "ง่าย/ถูกที่สุด แต่กระแสสตาร์ทพุ่ง 6–7 เท่า กระชากระบบไฟและเครื่องกล เหมาะมอเตอร์เล็ก" },
  { id: "star-delta", label: "Star–Delta", iStart: 2.5, tStart: 0.55, stress: "ปานกลาง", smooth: 2, color: "#f59e0b", note: "สตาร์ทแบบ Star (กระแส/แรงบิด ~1/3) แล้วสลับเป็น Delta — มีกระชากตอนสลับ แรงบิดสตาร์ทต่ำ" },
  { id: "soft", label: "Soft Starter", iStart: 3.5, tStart: 0.6, stress: "ต่ำ", smooth: 4, color: "#22d3ee", note: "ค่อย ๆ เพิ่มแรงดันให้กระแส/แรงบิดไต่ขึ้นนุ่มนวล ลดกระชาก แต่ยังสตาร์ทที่ความถี่คงที่" },
  { id: "vfd", label: "VFD", iStart: 1.3, tStart: 1.2, stress: "ต่ำสุด", smooth: 5, color: "#10b981", note: "เพิ่มความถี่จากศูนย์ทีละน้อย กระแสใกล้พิกัด แรงบิดควบคุมได้ นุ่มนวลที่สุด + ปรับรอบขณะเดินได้" },
];

const T_MAX = 5; // s
const STEPS = 48;

function currentAt(m: string, t: number): number {
  switch (m) {
    case "dol":
      return 1 + 5.5 * Math.exp(-t / 0.9);
    case "star-delta": {
      if (t < 1.8) return 1.4 + 1.1 * Math.exp(-t / 1.6); // star phase ~2.5→1.5
      const td = t - 1.8;
      return 1 + 3.0 * Math.exp(-td / 0.6); // delta re-spike ~4 then decay
    }
    case "soft": {
      const ramp = 2.6;
      if (t < ramp) return clamp(0.9 + 4.2 * (t / 0.7), 1, 3.5); // ramp up, hold ~3.5
      return 1 + 2.5 * Math.exp(-(t - ramp) / 0.5);
    }
    case "vfd": {
      const ramp = 3.2;
      return t < ramp ? 1.3 : 1.0;
    }
    default:
      return 1;
  }
}

function speedAt(m: string, t: number): number {
  switch (m) {
    case "dol":
      return (1 - Math.exp(-t / 0.9)) * 100;
    case "star-delta": {
      if (t < 1.8) return 0.55 * (1 - Math.exp(-t / 1.6)) * 100;
      const td = t - 1.8;
      return (0.55 * (1 - Math.exp(-1.8 / 1.6)) + 0.6 * (1 - Math.exp(-td / 0.7))) * 100;
    }
    case "soft":
      return clamp((t / 2.6) * 100, 0, 100);
    case "vfd":
      return clamp((t / 3.2) * 100, 0, 100);
    default:
      return 0;
  }
}

const STARS = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default function MotorStartingSim() {
  const [activeId, setActiveId] = useState("dol");

  const series = METHODS.map((m) => ({
    points: Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = (i / STEPS) * T_MAX;
      return { x: t, y: currentAt(m.id, t) };
    }),
    color: m.id === activeId ? m.color : "rgba(148,163,184,0.35)",
  }));
  const speedSeries = METHODS.filter((m) => m.id === activeId).map((m) => ({
    points: Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = (i / STEPS) * T_MAX;
      return { x: t, y: speedAt(m.id, t) };
    }),
    color: m.color,
  }));

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-deep-500 to-iris-600 text-2xl shadow-glow ring-1 ring-white/15">🚦</span>
        <div>
          <h1 className="bg-gradient-to-r from-ink to-ink-soft bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl dark:from-white dark:to-ink-soft">เปรียบเทียบการสตาร์ทมอเตอร์</h1>
          <p className="font-mono text-xs text-flow-600 dark:text-flow-300/80">Motor Starting — DOL · Star-Delta · Soft Starter · VFD</p>
        </div>
      </header>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
        ⚠️ เชิงการเรียนรู้ · กราฟเป็นรูปแบบโดยประมาณเพื่อเปรียบเทียบลักษณะการสตาร์ท · งานติดตั้ง/ตู้ควบคุมมอเตอร์จริงต้องทำโดยช่าง/วิศวกรที่ได้รับอนุญาต
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setActiveId(m.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeId === m.id ? "border-flow-400 bg-gradient-to-r from-flow-500/20 to-iris-500/20 text-flow-600 dark:text-flow-200" : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lab-card p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">⚡ กระแสสตาร์ท vs เวลา (× กระแสพิกัด)</h2>
          <LineChart series={series} xLabel="เวลา (s)" yLabel="I / FLC" domain={{ xMin: 0, xMax: T_MAX, yMin: 0, yMax: 7 }} />
          <p className="mt-1 text-center text-[11px] text-ink-faint">เส้นสว่าง = วิธีที่เลือก · DOL พุ่งสูงสุด · VFD ต่ำ/เรียบสุด</p>
        </div>
        <div className="lab-card p-4">
          <h2 className="mb-1 text-sm font-bold text-ink">⚙️ ความเร็ว vs เวลา (%)</h2>
          <LineChart series={speedSeries} xLabel="เวลา (s)" yLabel="speed %" domain={{ xMin: 0, xMax: T_MAX, yMin: 0, yMax: 100 }} />
          <p className="mt-1 text-center text-[11px] text-ink-faint">VFD/Soft ค่อย ๆ ไต่ขึ้น · DOL เร็วแต่กระชาก · Star-Delta มีสองช่วง</p>
        </div>
      </div>

      {/* comparison cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METHODS.map((m) => (
          <article key={m.id} className={`lab-card p-3 transition ${m.id === activeId ? "ring-aurora" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
              <h3 className="text-sm font-bold text-ink">{m.label}</h3>
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-ink-faint">กระแสสตาร์ท</dt><dd className="font-mono font-semibold text-ink">{m.iStart}× FLC</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">แรงบิดสตาร์ท</dt><dd className="font-mono font-semibold text-ink">{m.tStart}× rated</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">ความเครียดระบบ</dt><dd className="font-semibold text-ink">{m.stress}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-faint">ความนุ่มนวล</dt><dd className="text-amber-500">{STARS(m.smooth)}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <section className="mt-4 lab-card relative overflow-hidden p-4 pl-5">
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-flow-400 to-iris-500" />
        <h2 className="text-sm font-bold text-ink">📌 {METHODS.find((m) => m.id === activeId)?.label}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{METHODS.find((m) => m.id === activeId)?.note}</p>
      </section>
    </div>
  );
}
