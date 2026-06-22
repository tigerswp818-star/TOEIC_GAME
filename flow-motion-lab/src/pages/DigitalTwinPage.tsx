import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber, clamp } from "@/lib/math";
import { drawArrow, drawLabel, drawFlowParticle, softGlow, pulse, type Pt } from "@/lib/render/draw";

/* ───────────────────────── Scenario model (educational) ───────────────────────── */
type Sev = "ok" | "warn" | "alarm";
interface Scenario {
  id: string;
  label: string;
  flow: number; // m³/h (NaN = sensor fault)
  psuc: number; // bar
  pdis: number; // bar
  tank: number; // % level target
  current: number; // A
  freq: number; // Hz
  power: number; // kW
  vib: number; // mm/s
  cav?: boolean;
  sumpLow?: boolean;
  valveOpen: number; // 0..1 discharge valve
  alarms: { sev: Sev; msg: string }[];
  cause: string;
  checks: string[];
}

const SCENARIOS: Scenario[] = [
  { id: "normal", label: "ปกติ Normal", flow: 200, psuc: 0.4, pdis: 4.0, tank: 62, current: 42, freq: 45, power: 26, vib: 2.1, valveOpen: 1, alarms: [], cause: "ทุกค่าปกติ ปั๊มเดินใกล้ BEP จ่ายน้ำเข้าถังสม่ำเสมอ", checks: ["เฝ้าดู trend ความดัน/flow ให้คงที่", "ตรวจ kWh/m³ ว่าอยู่ในเกณฑ์"] },
  { id: "low-suction", label: "ระดับน้ำบ่อพักต่ำ", flow: 150, psuc: -0.35, pdis: 3.4, tank: 44, current: 38, freq: 45, power: 22, vib: 3.6, cav: true, sumpLow: true, valveOpen: 1, alarms: [{ sev: "warn", msg: "ระดับน้ำบ่อพักต่ำ — เสี่ยง cavitation" }], cause: "ระดับน้ำบ่อพัก/sump ต่ำ ทำให้ความดันด้านดูดติดลบ NPSHa ลด เสี่ยง cavitation", checks: ["ตรวจระดับน้ำบ่อพัก (level sensor)", "ตรวจ strainer ด้านดูดว่าอุดตันหรือไม่", "ลดรอบปั๊มชั่วคราวจนระดับน้ำกลับมา"] },
  { id: "high-discharge", label: "ความดันส่งสูง", flow: 120, psuc: 0.4, pdis: 7.6, tank: 80, current: 50, freq: 48, power: 31, vib: 2.6, valveOpen: 0.5, alarms: [{ sev: "alarm", msg: "ความดันด้านส่งสูงเกินกำหนด" }], cause: "ความต้องการใช้น้ำลด/วาล์วปลายทางหรี่ → ความดันด้านส่งสูง flow ลด", checks: ["ตรวจสถานะวาล์วปลายทาง", "ตรวจ pressure setpoint ของ PID/VFD", "ตรวจถังว่าเต็มหรือไม่"] },
  { id: "cavitation", label: "ปั๊ม Cavitation", flow: 140, psuc: -0.5, pdis: 3.2, tank: 50, current: 40, freq: 45, power: 23, vib: 6.8, cav: true, valveOpen: 1, alarms: [{ sev: "alarm", msg: "Cavitation ที่ปั๊ม — เสียงดัง/สั่นสูง" }], cause: "NPSHa < NPSHr เกิดฟองไอที่ใบพัด — สั่นสะเทือนสูง เสียงดัง ประสิทธิภาพตก", checks: ["ตรวจระดับน้ำ/ความดันด้านดูด", "ตรวจอุณหภูมิน้ำ", "ลด suction lift หรือ ลดรอบปั๊ม", "ตรวจ vibration trend"] },
  { id: "overload", label: "มอเตอร์โอเวอร์โหลด", flow: 210, psuc: 0.4, pdis: 4.4, tank: 64, current: 71, freq: 50, power: 38, vib: 4.2, valveOpen: 1, alarms: [{ sev: "alarm", msg: "กระแสมอเตอร์สูง — overload" }, { sev: "warn", msg: "อุณหภูมิมอเตอร์สูง" }], cause: "ปั๊มรับโหลดเกิน (เดิน run-out/แบริ่งฝืด) กระแสมอเตอร์สูงเกินพิกัด", checks: ["ตรวจ operating point ว่าเดิน run-out หรือไม่", "ตรวจ vibration/แบริ่ง", "⚠️ การตรวจระบบไฟฟ้าให้ช่าง/วิศวกรที่ได้รับอนุญาตเท่านั้น"] },
  { id: "leak", label: "ท่อรั่ว", flow: 235, psuc: 0.4, pdis: 2.6, tank: 50, current: 46, freq: 48, power: 27, vib: 2.3, valveOpen: 1, alarms: [{ sev: "warn", msg: "flow สูงผิดปกติ ความดันตก — สงสัยท่อรั่ว" }], cause: "flow สูงผิดปกติแต่ความดันด้านส่งตก — เป็นรูปแบบของท่อรั่ว/แตก", checks: ["เทียบ flow เข้า-ออก โครงข่าย", "ตรวจ trend ความดันว่าตกต่อเนื่อง", "สำรวจแนวท่อหาจุดรั่ว"] },
  { id: "valve-closed", label: "วาล์วด้านส่งปิด", flow: 6, psuc: 0.4, pdis: 8.8, tank: 60, current: 30, freq: 45, power: 18, vib: 2.8, valveOpen: 0.05, alarms: [{ sev: "alarm", msg: "flow ต่ำมาก ความดันพุ่ง — วาล์วด้านส่งปิด?" }], cause: "flow เกือบศูนย์แต่ความดันด้านส่งพุ่ง (shut-off) — วาล์วด้านส่งปิดหรือท่อตัน", checks: ["ตรวจสถานะ/ตำแหน่งวาล์วด้านส่ง", "ห้ามเดินปั๊มที่ shut-off นาน (ความร้อนสะสม)", "ตรวจ check valve ว่าค้างหรือไม่"] },
  { id: "sensor-fail", label: "เซนเซอร์ผิดพลาด", flow: NaN, psuc: 0.4, pdis: 4.0, tank: 62, current: 42, freq: 45, power: 26, vib: 2.1, valveOpen: 1, alarms: [{ sev: "warn", msg: "flow meter ไม่ส่งค่า — ตรวจสอบเซนเซอร์" }], cause: "flow meter อ่านค่าไม่ได้ (—) แต่ค่าอื่นปกติ — น่าจะเป็นที่ตัวเซนเซอร์/สายสัญญาณ", checks: ["เทียบกับค่าที่คำนวณจากปั๊ม/ความดัน", "ตรวจสายสัญญาณ/แหล่งจ่าย sensor", "อย่าใช้ค่าที่ผิดไปควบคุม PID"] },
];

const MODES = [
  { id: "manual", label: "Manual" },
  { id: "auto", label: "Auto" },
  { id: "pid", label: "PID" },
] as const;

/* pipe pressure → colour (bar) */
function pressureColorBar(bar: number): string {
  const t = clamp(bar / 9, 0, 1); // 0..9 bar
  // blue(low) → cyan → amber → red(high)
  if (t < 0.4) return `rgba(56,189,248,${0.5})`;
  if (t < 0.7) return `rgba(34,211,238,0.55)`;
  if (t < 0.85) return `rgba(245,158,11,0.6)`;
  return `rgba(239,68,68,0.65)`;
}

function sevColor(sev: Sev): string {
  return sev === "alarm" ? "text-rose-400" : sev === "warn" ? "text-amber-400" : "text-emerald-400";
}

/* sample a polyline (points) at fraction f∈[0,1] of total length → {x,y,dir} */
function samplePath(pts: Pt[], f: number): { x: number; y: number; ux: number; uy: number } {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segs.push(d);
    total += d;
  }
  let target = f * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] > 0 ? target / segs[i] : 0;
      const a = pts[i];
      const b = pts[i + 1];
      const ux = (b.x - a.x) / (segs[i] || 1);
      const uy = (b.y - a.y) / (segs[i] || 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ux, uy };
    }
    target -= segs[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ux: 1, uy: 0 };
}

export default function DigitalTwinPage() {
  const { theme } = useTheme();
  const [scenarioId, setScenarioId] = useState("normal");
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("auto");
  const [trend, setTrend] = useState<number[]>(() => Array(40).fill(4));

  const sc = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const stateRef = useRef(sc);
  stateRef.current = sc;
  const spinRef = useRef(0);
  const tankRef = useRef(sc.tank);
  const particles = useRef(Array.from({ length: 80 }, () => ({ t: Math.random() })));
  const bubbles = useRef(Array.from({ length: 26 }, () => ({ off: Math.random() * 2 - 1, along: Math.random(), life: Math.random() })));

  // rolling trend of discharge pressure (sampled every second)
  useEffect(() => {
    const id = setInterval(() => {
      setTrend((prev) => {
        const v = stateRef.current.pdis + (Math.sin(Date.now() / 900) * 0.06);
        return [...prev.slice(1), v];
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const s = stateRef.current;
    const flowing = (Number.isNaN(s.flow) ? 200 : s.flow) * s.valveOpen;
    const flowNorm = clamp(flowing / 240, 0, 1);
    const nFreq = s.freq / 50;

    // layout coordinates
    const sumpX = width * 0.06;
    const sumpW = width * 0.13;
    const sumpY = height * 0.52;
    const sumpH = height * 0.4;
    const pumpX = width * 0.36;
    const pumpY = height * 0.62;
    const R = Math.min(width, height) * 0.075;
    const cvX = width * 0.55; // check valve
    const gvX = width * 0.66; // gate valve
    const tankX = width * 0.83;
    const tankW = width * 0.13;
    const tankY = height * 0.16;
    const tankH = height * 0.62;

    // flow path waypoints (sump → pump → check valve → gate valve → tank top)
    const path: Pt[] = [
      { x: sumpX + sumpW, y: sumpY + sumpH * 0.5 },
      { x: pumpX - R, y: pumpY },
      { x: pumpX + R, y: pumpY },
      { x: cvX, y: pumpY },
      { x: gvX, y: pumpY },
      { x: tankX + tankW * 0.5, y: pumpY },
      { x: tankX + tankW * 0.5, y: tankY + tankH },
    ];

    // ── pipes (coloured by pressure section) ──
    const drawPipe = (a: Pt, b: Pt, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    // suction (low pressure → blue)
    drawPipe(path[0], path[1], pressureColorBar(s.psuc + 1));
    // discharge sections (by pdis)
    for (let i = 2; i < path.length - 1; i++) drawPipe(path[i], path[i + 1], pressureColorBar(s.pdis));

    // ── sump (reservoir) ──
    ctx.fillStyle = dark ? "rgba(15,23,42,0.6)" : "rgba(226,232,240,0.6)";
    ctx.fillRect(sumpX, sumpY, sumpW, sumpH);
    const sumpFill = s.sumpLow ? 0.28 : 0.7;
    ctx.fillStyle = "rgba(56,189,248,0.45)";
    ctx.fillRect(sumpX, sumpY + sumpH * (1 - sumpFill), sumpW, sumpH * sumpFill);
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sumpX, sumpY, sumpW, sumpH);
    drawLabel(ctx, "บ่อพัก Sump", sumpX + sumpW / 2, sumpY - 8, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // ── flow particles along path (rate ∝ flow) ──
    for (const p of particles.current) {
      p.t += (0.04 + flowNorm * 0.22) * dt;
      if (p.t > 1) p.t -= 1;
      if (flowNorm < 0.02) continue;
      const pos = samplePath(path, p.t);
      const col = s.pdis > 7 ? "239, 68, 68" : pos.x < pumpX ? "56, 189, 248" : "103, 232, 249";
      drawFlowParticle(ctx, pos.x, pos.y, pos.ux, pos.uy, col, { radius: 2.2, trail: flowNorm * 9, alpha: 0.85 });
    }

    // ── pump (volute + spinning impeller, speed ∝ freq) ──
    spinRef.current += nFreq * dt * 9;
    ctx.beginPath();
    ctx.arc(pumpX, pumpY, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(56,189,248,0.18)" : "rgba(207,250,254,0.7)";
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.translate(pumpX, pumpY);
    ctx.rotate(spinRef.current);
    ctx.strokeStyle = s.cav ? "rgba(248,250,252,0.9)" : "rgba(103,232,249,0.9)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
      ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.55, Math.sin(a + 0.5) * R * 0.55, Math.cos(a + 0.9) * R * 0.8, Math.sin(a + 0.9) * R * 0.8);
      ctx.stroke();
    }
    ctx.restore();
    drawLabel(ctx, "ปั๊ม Pump", pumpX, pumpY + R + 14, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // cavitation bubbles at pump
    if (s.cav) {
      for (const b of bubbles.current) {
        b.life += dt * 0.8;
        if (b.life > 1) { b.life = 0; b.off = Math.random() * 2 - 1; b.along = Math.random(); }
        const bx = pumpX - R * 0.5 + b.along * R;
        const by = pumpY + b.off * R * 0.5;
        const grow = Math.sin(b.life * Math.PI);
        if (b.life > 0.8) softGlow(ctx, bx, by, 6, "248,250,252", 0.5);
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(0.5, grow * 3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,240,255,${0.3 + 0.4 * grow})`;
        ctx.fill();
      }
    }

    // ── motor + VFD (box above pump) ──
    const mW = R * 1.6;
    const mH = R * 0.9;
    ctx.fillStyle = s.current > 65 ? "rgba(239,68,68,0.25)" : dark ? "rgba(30,58,95,0.6)" : "rgba(203,213,225,0.7)";
    ctx.fillRect(pumpX - mW / 2, pumpY - R - mH - 8, mW, mH);
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.strokeRect(pumpX - mW / 2, pumpY - R - mH - 8, mW, mH);
    drawLabel(ctx, "M", pumpX, pumpY - R - mH / 2 - 8, { align: "center", font: "bold 13px 'JetBrains Mono', monospace", color: dark ? "#e2e8f0" : "#0f172a", bg: "rgba(0,0,0,0)" });
    // VFD frequency display
    drawLabel(ctx, `${formatNumber(s.freq, 0)} Hz`, pumpX, pumpY - R - mH - 18, { align: "center", font: "bold 15px 'JetBrains Mono', monospace", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.8)" : "rgba(255,255,255,0.9)" });

    // ── check valve & gate valve ──
    const valveGlyph = (x: number, label: string, open: number, isGate: boolean) => {
      ctx.fillStyle = open > 0.5 ? "#10b981" : open > 0.1 ? "#f59e0b" : "#ef4444";
      if (isGate) {
        const gh = (10) * (1 - open);
        ctx.fillRect(x - 7, pumpY - 12, 14, gh + 1);
        ctx.fillRect(x - 7, pumpY + 12 - gh, 14, gh + 1);
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 7, pumpY - 10);
        ctx.lineTo(x + 7, pumpY);
        ctx.lineTo(x - 7, pumpY + 10);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = dark ? "#e2e8f0" : "#0f172a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 8, pumpY - 13, 16, 26);
      drawLabel(ctx, label, x, pumpY - 22, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });
    };
    valveGlyph(cvX, "เช็ควาล์ว", 1, false);
    valveGlyph(gvX, "เกตวาล์ว", s.valveOpen, true);

    // ── elevated tank (right) with animated level ──
    tankRef.current = tankRef.current + (s.tank - tankRef.current) * 0.04;
    const lvl = clamp(tankRef.current / 100, 0, 1);
    ctx.fillStyle = dark ? "rgba(15,23,42,0.5)" : "rgba(226,232,240,0.55)";
    ctx.fillRect(tankX, tankY, tankW, tankH);
    // water with surface ripple
    const waterTop = tankY + tankH * (1 - lvl);
    ctx.fillStyle = "rgba(56,189,248,0.5)";
    ctx.beginPath();
    ctx.moveTo(tankX, tankY + tankH);
    ctx.lineTo(tankX, waterTop);
    for (let i = 0; i <= 10; i++) {
      const xx = tankX + (i / 10) * tankW;
      ctx.lineTo(xx, waterTop + Math.sin(time * 2 + i) * 2);
    }
    ctx.lineTo(tankX + tankW, tankY + tankH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tankX, tankY, tankW, tankH);
    drawLabel(ctx, "ถังสูง Tank", tankX + tankW / 2, tankY - 8, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    drawLabel(ctx, `${formatNumber(tankRef.current, 0)}%`, tankX + tankW / 2, tankY + tankH * 0.5, { align: "center", font: "bold 14px 'JetBrains Mono', monospace", color: "#fff", bg: "rgba(8,13,24,0.55)" });

    // distribution arrows out of tank
    if (flowNorm > 0.02 || true) {
      drawArrow(ctx, tankX + tankW, tankY + tankH * 0.4, width - 6, tankY + tankH * 0.4, "#67e8f9", 2.5, 8);
      drawLabel(ctx, "จ่ายน้ำ", width - 8, tankY + tankH * 0.4 - 12, { align: "right", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });
    }

    // alarm border flash when any alarm active
    const worst = s.alarms.some((a) => a.sev === "alarm") ? "alarm" : s.alarms.some((a) => a.sev === "warn") ? "warn" : "ok";
    if (worst !== "ok") {
      ctx.strokeStyle = worst === "alarm" ? `rgba(239,68,68,${0.4 + 0.4 * pulse(time, 1)})` : `rgba(245,158,11,${0.35})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, width - 4, height - 4);
    }
  };

  // sensor display values (mode tweaks)
  const flowDisplay = Number.isNaN(sc.flow) ? "—" : formatNumber(sc.flow * sc.valveOpen, 0);
  const kWhm3 = !Number.isNaN(sc.flow) && sc.flow * sc.valveOpen > 0 ? sc.power / (sc.flow * sc.valveOpen) : NaN;
  const worstSev: Sev = sc.alarms.some((a) => a.sev === "alarm") ? "alarm" : sc.alarms.some((a) => a.sev === "warn") ? "warn" : "ok";
  const statusLabel = worstSev === "alarm" ? "ALARM" : worstSev === "warn" ? "WARNING" : "NORMAL";
  const statusColor = worstSev === "alarm" ? "bg-rose-500" : worstSev === "warn" ? "bg-amber-500" : "bg-emerald-500";

  const modeNote = mode === "pid"
    ? "PID: VFD ปรับรอบอัตโนมัติเพื่อรักษาแรงดันปลายทางตาม setpoint"
    : mode === "auto"
      ? "Auto: ระบบเดิน/หยุดปั๊มตามระดับถังและความต้องการ"
      : "Manual: ผู้ควบคุมตั้งความถี่ VFD เอง (เฝ้าระวังด้วยตนเอง)";

  const Sensor = ({ label, value, unit, tone = "" }: { label: string; value: string; unit: string; tone?: string }) => (
    <div className="rounded-lg border border-line bg-surface-soft/70 px-2.5 py-1.5">
      <div className="text-[10px] text-ink-faint">{label}</div>
      <div className={`font-mono text-base font-bold tabular-nums ${tone || "text-ink"}`}>
        {value} <span className="text-[10px] font-normal text-ink-soft">{unit}</span>
      </div>
    </div>
  );

  // trend sparkline geometry
  const tMin = 0;
  const tMax = 10;
  const trendPts = trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${100 - ((clamp(v, tMin, tMax) - tMin) / (tMax - tMin)) * 100}`).join(" ");

  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-deep-500 to-iris-600 text-2xl shadow-glow ring-1 ring-white/15">🏭</span>
          <div className="min-w-0">
            <h1 className="bg-gradient-to-r from-ink to-ink-soft bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl dark:from-white dark:to-ink-soft">
              Pump Station Digital Twin
            </h1>
            <p className="font-mono text-xs text-flow-600 dark:text-flow-300/80">SCADA mockup เชิงการเรียนรู้ — ไม่ใช่ระบบควบคุมจริง</p>
          </div>
          <span className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold text-white ${statusColor}`}>
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-white" /> {statusLabel}
          </span>
        </div>
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          ⚠️ สื่อการเรียนรู้เท่านั้น · งานไฟฟ้าแรงสูง เครื่องจักรหมุน และระบบแรงดันจริง ต้องดำเนินการโดยวิศวกร/ช่างผู้ชำนาญที่ได้รับอนุญาต
        </div>
      </header>

      {/* scenario + mode selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-soft">สถานการณ์ Scenario:</span>
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => setScenarioId(s.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              scenarioId === s.id ? "border-flow-400 bg-gradient-to-r from-flow-500/20 to-iris-500/20 text-flow-600 dark:text-flow-200" : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* schematic */}
        <div className="group relative">
          <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-br from-flow-400/30 via-deep-500/10 to-iris-500/30 opacity-70 blur-lg" />
          <div className="lab-card relative overflow-hidden ring-1 ring-white/10">
            <div className="relative aspect-[16/10] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#0a1426] dark:to-[#060b16]">
              <ParticleFlowCanvas draw={draw} playing speed={1} theme={theme} className="block h-full w-full" ariaLabel="แผนผังสถานีสูบจ่ายน้ำแบบเคลื่อนไหว" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
              <span className="text-xs font-semibold text-ink-soft">โหมดควบคุม:</span>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === m.id ? "bg-gradient-to-r from-flow-500 to-iris-500 text-white shadow-glow" : "bg-surface-soft text-ink-soft hover:bg-surface-raised"}`}
                >
                  {m.label}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-ink-faint">{modeNote}</span>
            </div>
          </div>
        </div>

        {/* right rail: sensors + energy + alarms + trend */}
        <div className="space-y-4">
          <div className="lab-card p-3">
            <h2 className="mb-2 text-sm font-bold text-ink">📟 ค่าจากเซนเซอร์ Sensors</h2>
            <div className="grid grid-cols-2 gap-2">
              <Sensor label="อัตราการไหล" value={flowDisplay} unit="m³/h" tone={Number.isNaN(sc.flow) ? "text-amber-400" : ""} />
              <Sensor label="ความดันด้านส่ง" value={formatNumber(sc.pdis)} unit="bar" tone={sc.pdis > 7 ? "text-rose-400" : ""} />
              <Sensor label="ความดันด้านดูด" value={formatNumber(sc.psuc)} unit="bar" tone={sc.psuc < 0 ? "text-amber-400" : ""} />
              <Sensor label="ระดับถัง" value={formatNumber(sc.tank, 0)} unit="%" />
              <Sensor label="ความถี่ VFD" value={formatNumber(sc.freq, 0)} unit="Hz" tone="text-flow-500" />
              <Sensor label="กระแสมอเตอร์" value={formatNumber(sc.current, 0)} unit="A" tone={sc.current > 65 ? "text-rose-400" : ""} />
              <Sensor label="กำลังไฟฟ้า" value={formatNumber(sc.power, 0)} unit="kW" />
              <Sensor label="การสั่นสะเทือน" value={formatNumber(sc.vib)} unit="mm/s" tone={sc.vib > 4.5 ? "text-rose-400" : sc.vib > 3 ? "text-amber-400" : ""} />
            </div>
          </div>

          <div className="lab-card p-3">
            <h2 className="mb-2 text-sm font-bold text-ink">⚡ พลังงาน Energy</h2>
            <div className="grid grid-cols-2 gap-2">
              <Sensor label="กำลังไฟฟ้า" value={formatNumber(sc.power, 0)} unit="kW" />
              <Sensor label="พลังงานจำเพาะ" value={Number.isNaN(kWhm3) ? "—" : formatNumber(kWhm3, 3)} unit="kWh/m³" tone="text-emerald-400" />
            </div>
          </div>

          <div className="lab-card p-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">📈 แนวโน้มความดันส่ง</h2>
              <span className="text-[10px] text-ink-faint">bar · 40 วิ</span>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
              <polyline points={trendPts} fill="none" stroke="#22d3ee" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          <div className="lab-card p-3">
            <h2 className="mb-2 text-sm font-bold text-ink">🚨 การแจ้งเตือน Alarms</h2>
            {sc.alarms.length === 0 ? (
              <p className="text-xs text-emerald-500">✓ ไม่มีการแจ้งเตือน — ระบบปกติ</p>
            ) : (
              <ul className="space-y-1.5">
                {sc.alarms.map((a, i) => (
                  <li key={i} className={`flex items-start gap-1.5 text-xs ${sevColor(a.sev)}`}>
                    <span>{a.sev === "alarm" ? "⛔" : "⚠️"}</span>
                    <span>{a.msg}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* scenario explanation + checks */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="lab-card relative overflow-hidden p-4 pl-5">
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-flow-400 to-iris-500" />
          <h2 className="text-sm font-bold text-ink">🔎 สาเหตุที่เป็นไปได้</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{sc.cause}</p>
        </div>
        <div className="lab-card p-4">
          <h2 className="text-sm font-bold text-ink">✅ การตรวจสอบเบื้องต้น (ปลอดภัย)</h2>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
            {sc.checks.map((c, i) => (
              <li key={i} className="flex gap-2"><span className="text-flow-500">•</span><span>{c}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
