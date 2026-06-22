import { useState } from "react";

type Likelihood = "สูง" | "กลาง" | "ต่ำ";
interface Cause {
  cause: string;
  likelihood: Likelihood;
  checks: string[];
}
interface Symptom {
  id: string;
  label: string;
  icon: string;
  causes: Cause[];
}

const SYMPTOMS: Symptom[] = [
  {
    id: "no-flow",
    label: "น้ำไม่ขึ้น / ไม่มี flow",
    icon: "🚱",
    causes: [
      { cause: "ปั๊มไม่ได้ไล่อากาศ (air lock / ไม่ได้ priming)", likelihood: "สูง", checks: ["ตรวจว่ามีน้ำเต็มเรือนปั๊มและท่อดูด", "ไล่อากาศ/เติมน้ำ (prime) ก่อนเดิน"] },
      { cause: "วาล์วด้านดูดหรือด้านส่งปิดอยู่", likelihood: "สูง", checks: ["ตรวจตำแหน่งวาล์วทุกตัวว่าเปิด", "ตรวจ check valve ว่าค้าง/กลับด้านหรือไม่"] },
      { cause: "ปั๊มหมุนกลับทิศ (wrong rotation)", likelihood: "กลาง", checks: ["ตรวจทิศหมุนเทียบลูกศรบนเรือนปั๊ม", "⚠️ การสลับเฟส/แก้ทิศหมุนต้องให้ช่างไฟฟ้าดำเนินการ"] },
      { cause: "ระดับน้ำบ่อพักต่ำกว่าท่อดูด", likelihood: "กลาง", checks: ["ตรวจ level sensor บ่อพัก", "ตรวจ foot valve / strainer อุดตัน"] },
    ],
  },
  {
    id: "low-flow",
    label: "flow ต่ำกว่าปกติ",
    icon: "📉",
    causes: [
      { cause: "วาล์วเปิดไม่สุด / โครงข่ายต้านมาก (system curve ชัน)", likelihood: "สูง", checks: ["ตรวจการเปิดวาล์ว", "เทียบ operating point กับ pump/system curve"] },
      { cause: "ใบพัดสึก/อุดตัน (impeller wear/clog)", likelihood: "กลาง", checks: ["เทียบ head ที่ได้กับ pump curve ที่รอบเดียวกัน", "ตรวจสิ่งอุดตันที่ใบพัด/strainer"] },
      { cause: "ความถี่ VFD ตั้งต่ำเกินไป", likelihood: "กลาง", checks: ["ตรวจ setpoint ความถี่/ความดันของ VFD"] },
      { cause: "ท่อรั่ว/อากาศเข้าด้านดูด", likelihood: "ต่ำ", checks: ["สำรวจรอยรั่ว", "ตรวจข้อต่อด้านดูดว่ารั่วอากาศหรือไม่"] },
    ],
  },
  {
    id: "low-pressure",
    label: "ความดันด้านส่งต่ำ",
    icon: "🔽",
    causes: [
      { cause: "ท่อรั่ว/แตกในโครงข่าย", likelihood: "สูง", checks: ["เทียบ flow เข้า-ออก", "ดู trend ความดันว่าตกต่อเนื่อง", "สำรวจแนวท่อ"] },
      { cause: "ใบพัดสึกหรือรอบปั๊มต่ำ", likelihood: "กลาง", checks: ["เทียบ head กับ pump curve", "ตรวจความถี่ VFD"] },
      { cause: "ความต้องการใช้น้ำสูง (peak demand)", likelihood: "กลาง", checks: ["ดู trend flow ช่วงเวลานั้น", "พิจารณาเดินปั๊มเสริม (assist)"] },
    ],
  },
  {
    id: "high-pressure",
    label: "ความดันด้านส่งสูง",
    icon: "🔼",
    causes: [
      { cause: "วาล์วปลายทางปิด/หรี่ (เข้าใกล้ shut-off)", likelihood: "สูง", checks: ["ตรวจสถานะวาล์วปลายทาง", "⚠️ อย่าเดินที่ shut-off นาน — ความร้อนสะสม"] },
      { cause: "ถังเต็ม/ความต้องการใช้น้ำลด", likelihood: "กลาง", checks: ["ตรวจระดับถัง", "ตรวจ setpoint ของ PID"] },
      { cause: "ตั้ง setpoint ความดันสูงเกินไป", likelihood: "ต่ำ", checks: ["ทบทวน setpoint ความดันของ VFD/PID"] },
    ],
  },
  {
    id: "high-current",
    label: "กระแสมอเตอร์สูง / Overload",
    icon: "🔥",
    causes: [
      { cause: "ปั๊มเดิน run-out (flow สูง head ต่ำ)", likelihood: "สูง", checks: ["ตรวจ operating point ว่าเลย BEP ไปทาง flow มาก", "หรี่วาล์ว/ลดรอบเพื่อย้ายจุดทำงาน"] },
      { cause: "แบริ่ง/ซีลฝืด หรือใบพัดเสียดสี", likelihood: "กลาง", checks: ["ตรวจ vibration trend", "ฟังเสียงผิดปกติ (จากภายนอก)"] },
      { cause: "แรงดันไฟ/เฟสผิดปกติ", likelihood: "กลาง", checks: ["ดู alarm จาก VFD/มอเตอร์", "⚠️ การตรวจระบบไฟฟ้าให้ช่าง/วิศวกรที่ได้รับอนุญาตเท่านั้น"] },
    ],
  },
  {
    id: "vibration",
    label: "สั่นสะเทือน / เสียงดัง",
    icon: "📳",
    causes: [
      { cause: "Cavitation (เสียงเหมือนกรวดในปั๊ม)", likelihood: "สูง", checks: ["ตรวจ NPSHa: ระดับน้ำดูด/อุณหภูมิ/loss ด้านดูด", "ลด suction lift หรือ ลดรอบปั๊ม"] },
      { cause: "แบริ่งเสีย / เพลาไม่ได้ศูนย์ (misalignment)", likelihood: "กลาง", checks: ["ดู vibration trend และความถี่การสั่น", "นัดช่างตรวจการตั้งศูนย์/แบริ่ง"] },
      { cause: "ใบพัดไม่สมดุล/มีสิ่งติด", likelihood: "กลาง", checks: ["ตรวจสิ่งอุดตัน", "ตรวจการสึกของใบพัด"] },
    ],
  },
  {
    id: "vfd-trip",
    label: "VFD Trip / Fault",
    icon: "⛔",
    causes: [
      { cause: "Overcurrent (โหลดเกิน/ลัดวงจร)", likelihood: "สูง", checks: ["อ่านรหัส fault ที่หน้าจอ VFD", "ตรวจว่าปั๊มฝืด/อุดตันหรือไม่", "⚠️ ห้ามเปิดตู้ไฟเอง — ให้ช่างไฟฟ้า"] },
      { cause: "Over/Undervoltage", likelihood: "กลาง", checks: ["ตรวจ alarm แรงดันที่ VFD", "⚠️ งานไฟฟ้าให้ช่าง/วิศวกรที่ได้รับอนุญาต"] },
      { cause: "Dry-run / สูญเสียโหลด", likelihood: "กลาง", checks: ["ตรวจระดับน้ำบ่อพัก", "ตรวจการตั้ง dry-run protection"] },
      { cause: "Overheat (ไดร์ฟร้อนเกิน)", likelihood: "ต่ำ", checks: ["ตรวจการระบายความร้อน/พัดลมตู้", "ตรวจอุณหภูมิแวดล้อม"] },
    ],
  },
  {
    id: "cavitation",
    label: "ปั๊ม Cavitation",
    icon: "🫧",
    causes: [
      { cause: "NPSHa < NPSHr (ความดันด้านดูดต่ำ)", likelihood: "สูง", checks: ["ตรวจระดับน้ำ/ความดันด้านดูด", "ตรวจ strainer ด้านดูดอุดตัน", "ลด suction lift / ลดรอบ"] },
      { cause: "น้ำร้อน → vapor pressure สูง", likelihood: "กลาง", checks: ["ตรวจอุณหภูมิน้ำ", "เลือกปั๊ม NPSHr ต่ำลงถ้าจำเป็น"] },
    ],
  },
];

const LIKELIHOOD_TONE: Record<Likelihood, string> = {
  สูง: "border-rose-400/40 bg-rose-500/15 text-rose-600 dark:text-rose-300",
  กลาง: "border-amber-400/40 bg-amber-500/15 text-amber-600 dark:text-amber-300",
  ต่ำ: "border-line bg-surface-soft text-ink-faint",
};

export default function TroubleshootingSim() {
  const [active, setActive] = useState<string>("low-flow");
  const sym = SYMPTOMS.find((s) => s.id === active) ?? SYMPTOMS[0];

  return (
    <div className="mx-auto max-w-5xl animate-fade-in px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-deep-500 to-iris-600 text-2xl shadow-glow ring-1 ring-white/15">🔧</span>
        <div>
          <h1 className="bg-gradient-to-r from-ink to-ink-soft bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl dark:from-white dark:to-ink-soft">
            เครื่องมือวิเคราะห์ปัญหาปั๊ม
          </h1>
          <p className="font-mono text-xs text-flow-600 dark:text-flow-300/80">Pump Troubleshooting — เลือกอาการเพื่อดูสาเหตุและการตรวจสอบ</p>
        </div>
      </header>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
        ⚠️ เครื่องมือเชิงการเรียนรู้ — แนวทางตรวจสอบเบื้องต้นเท่านั้น · <b>ห้ามเปิดตู้ไฟหรือซ่อมไฟฟ้าเอง</b> การตรวจระบบไฟฟ้าและเครื่องจักรหมุนต้องทำโดยช่าง/วิศวกรที่ได้รับอนุญาต
      </div>

      {/* symptom picker */}
      <div className="mb-5">
        <div className="mb-2 text-sm font-semibold text-ink">เลือกอาการที่พบ Symptom</div>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active === s.id
                  ? "border-flow-400 bg-gradient-to-r from-flow-500/20 to-iris-500/20 text-flow-600 dark:text-flow-200"
                  : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"
              }`}
            >
              <span aria-hidden>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* possible causes */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <span className="text-lg">{sym.icon}</span> สาเหตุที่เป็นไปได้ของ “{sym.label}” ({sym.causes.length})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {sym.causes.map((c, i) => (
          <article key={i} className="lab-card animate-rise p-4" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold leading-tight text-ink">{c.cause}</h3>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${LIKELIHOOD_TONE[c.likelihood]}`}>
                โอกาส {c.likelihood}
              </span>
            </div>
            <div className="mt-2.5 text-xs font-semibold text-ink-soft">✅ การตรวจสอบเบื้องต้น (ปลอดภัย):</div>
            <ul className="mt-1 space-y-1 text-sm text-ink-soft">
              {c.checks.map((ch, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-flow-500">•</span>
                  <span>{ch}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="mt-5 text-center text-xs text-ink-faint">
        เคล็ดลับ: ใช้ค่าใน <b>Digital Twin</b> (pressure ดูด/ส่ง, flow, vibration, kWh/m³) และ trend ช่วยยืนยันสาเหตุก่อนเรียกช่าง
      </p>
    </div>
  );
}
