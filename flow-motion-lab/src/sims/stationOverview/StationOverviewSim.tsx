import { useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ToggleChip from "@/components/sim/ToggleChip";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber, clamp, approach } from "@/lib/math";
import { drawArrow, drawLabel, drawFlowParticle, type Pt } from "@/lib/render/draw";
import type { GuidedStep, LearningMode, QuizItem } from "@/types/simulation";

type LayerKey = "flow" | "pressure" | "status" | "vfd" | "valve" | "sensor" | "energy";
const LAYERS: { key: LayerKey; label: string; icon: string }[] = [
  { key: "flow", label: "เส้นทางน้ำ Flow", icon: "💧" },
  { key: "pressure", label: "จุดความดัน Pressure", icon: "🌡" },
  { key: "status", label: "สถานะปั๊ม/มอเตอร์", icon: "🟢" },
  { key: "vfd", label: "ความถี่ VFD", icon: "🎛" },
  { key: "valve", label: "ตำแหน่งวาล์ว Valve", icon: "🔧" },
  { key: "sensor", label: "ข้อมูลเซนเซอร์ Sensor", icon: "📟" },
  { key: "energy", label: "พลังงาน Energy", icon: "⚡" },
];

const DEFAULT_LAYERS: Record<LayerKey, boolean> = { flow: true, pressure: true, status: true, vfd: true, valve: true, sensor: true, energy: true };

function samplePath(pts: Pt[], f: number) {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); segs.push(d); total += d; }
  let target = f * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] > 0 ? target / segs[i] : 0;
      const a = pts[i]; const b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ux: (b.x - a.x) / (segs[i] || 1), uy: (b.y - a.y) / (segs[i] || 1) };
    }
    target -= segs[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ux: 1, uy: 0 };
}

const guidedSteps: GuidedStep[] = [
  { title: "องค์ประกอบของสถานี", body: "ไล่ดูจากซ้าย: บ่อพัก (Sump) → ปั๊ม + มอเตอร์ + VFD → เช็ควาล์ว/เกตวาล์ว → ถังสูง → จ่ายน้ำเข้าโครงข่าย แต่ละส่วนมีหน้าที่ของตัวเอง", apply: { load: 70 } },
  { title: "เปิด/ปิด layer", body: "ใช้ปุ่ม layer ด้านล่างเพื่อแสดง/ซ่อนข้อมูล เช่น จุดความดัน ความถี่ VFD ตำแหน่งวาล์ว และพลังงาน — เหมือนหน้าจอ SCADA", apply: {} },
  { title: "ปรับโหลด", body: "เลื่อนแถบ 'ความต้องการใช้น้ำ' จะเห็นน้ำไหลเร็วขึ้น ปั๊มหมุนเร็วขึ้น (VFD เพิ่ม Hz) และพลังงานเพิ่มขึ้น", apply: { load: 100 } },
];

const quiz: QuizItem[] = [
  { question: "ลำดับการไหลของน้ำในสถานีสูบจ่ายน้ำคือ?", choices: ["ถัง → ปั๊ม → บ่อพัก", "บ่อพัก → ปั๊ม → ท่อส่ง → ถัง/โครงข่าย", "ปั๊ม → บ่อพัก → ถัง", "โครงข่าย → ปั๊ม → ถัง"], answer: 1, explain: "น้ำจากบ่อพักถูกปั๊มส่งผ่านท่อส่ง (ผ่านเช็ค/เกตวาล์ว) ไปเก็บที่ถังสูงแล้วจ่ายเข้าโครงข่าย" },
  { question: "VFD ในสถานีทำหน้าที่อะไร?", choices: ["วัดความดัน", "ปรับความถี่เพื่อคุมรอบมอเตอร์/ปั๊ม", "กันน้ำไหลกลับ", "เก็บน้ำ"], answer: 1, explain: "VFD ปรับความถี่ไฟให้มอเตอร์ จึงปรับรอบปั๊มเพื่อคุมอัตราการไหล/แรงดันและประหยัดพลังงาน" },
  { question: "เช็ควาล์ว (check valve) มีไว้เพื่อ?", choices: ["เพิ่มแรงดัน", "กันน้ำไหลย้อนกลับเข้าปั๊มเมื่อปั๊มหยุด", "วัดอัตราการไหล", "ลดอุณหภูมิ"], answer: 1, explain: "เช็ควาล์วยอมให้น้ำไหลทางเดียว ป้องกันการไหลย้อนกลับเข้าปั๊มเมื่อปั๊มหยุด" },
];

export default function StationOverviewSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [load, setLoad] = useState(70);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const lf = load / 100;
  const freq = 30 + lf * 20;
  const flowH = lf * 240;
  const psuc = 0.4;
  const pdis = 2.4 + lf * 3.2;
  const powerKW = lf * 30;
  const stateRef = useRef({ lf, freq, flowH, psuc, pdis, powerKW, layers });
  stateRef.current = { lf, freq, flowH, psuc, pdis, powerKW, layers };

  const spinRef = useRef(0);
  const nDispRef = useRef(freq / 50);
  const tankRef = useRef(60);
  const parts = useRef(Array.from({ length: 60 }, () => ({ t: Math.random() })));

  const toggle = (k: LayerKey) => setLayers((p) => ({ ...p, [k]: !p[k] }));
  const applyPreset = (vals: Record<string, number>) => { if (typeof vals.load === "number") setLoad(vals.load); };

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const s = stateRef.current;
    const L = s.layers;
    const flowNorm = clamp(s.flowH / 240, 0, 1);
    nDispRef.current = approach(nDispRef.current, s.freq / 50, 0.1);

    const sumpX = width * 0.05, sumpW = width * 0.12, sumpY = height * 0.5, sumpH = height * 0.4;
    const pumpX = width * 0.34, pumpY = height * 0.62, R = Math.min(width, height) * 0.07;
    const cvX = width * 0.52, gvX = width * 0.63;
    const tankX = width * 0.82, tankW = width * 0.13, tankY = height * 0.14, tankH = height * 0.6;

    const path: Pt[] = [
      { x: sumpX + sumpW, y: sumpY + sumpH * 0.5 },
      { x: pumpX - R, y: pumpY }, { x: pumpX + R, y: pumpY },
      { x: cvX, y: pumpY }, { x: gvX, y: pumpY },
      { x: tankX + tankW * 0.5, y: pumpY }, { x: tankX + tankW * 0.5, y: tankY + tankH },
    ];

    // pipes
    const pipeCol = L.pressure
      ? (bar: number) => (bar > 6 ? "rgba(239,68,68,0.6)" : bar > 4 ? "rgba(245,158,11,0.55)" : "rgba(34,211,238,0.5)")
      : () => (dark ? "rgba(100,116,139,0.5)" : "rgba(148,163,184,0.6)");
    const drawPipe = (a: Pt, b: Pt, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = 11; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    drawPipe(path[0], path[1], pipeCol(s.psuc + 1));
    for (let i = 2; i < path.length - 1; i++) drawPipe(path[i], path[i + 1], pipeCol(s.pdis));

    // sump
    ctx.fillStyle = dark ? "rgba(15,23,42,0.6)" : "rgba(226,232,240,0.6)";
    ctx.fillRect(sumpX, sumpY, sumpW, sumpH);
    ctx.fillStyle = "rgba(56,189,248,0.45)";
    ctx.fillRect(sumpX, sumpY + sumpH * 0.3, sumpW, sumpH * 0.7);
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8"; ctx.lineWidth = 2.5; ctx.strokeRect(sumpX, sumpY, sumpW, sumpH);
    drawLabel(ctx, "บ่อพัก Sump", sumpX + sumpW / 2, sumpY - 8, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // flow particles
    if (L.flow) {
      for (const p of parts.current) {
        p.t += (0.04 + flowNorm * 0.2) * dt; if (p.t > 1) p.t -= 1;
        if (flowNorm < 0.02) continue;
        const pos = samplePath(path, p.t);
        drawFlowParticle(ctx, pos.x, pos.y, pos.ux, pos.uy, pos.x < pumpX ? "56, 189, 248" : "103, 232, 249", { radius: 2.1, trail: flowNorm * 8, alpha: 0.85 });
      }
      drawArrow(ctx, sumpX + sumpW + 4, sumpY + sumpH * 0.5, pumpX - R - 6, pumpY, "#f59e0b", 2, 7);
    }

    // pump + impeller
    spinRef.current += nDispRef.current * dt * 9;
    ctx.beginPath(); ctx.arc(pumpX, pumpY, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(56,189,248,0.18)" : "rgba(207,250,254,0.7)"; ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b"; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(pumpX, pumpY); ctx.rotate(spinRef.current);
    ctx.strokeStyle = "rgba(103,232,249,0.9)"; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28); ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.55, Math.sin(a + 0.5) * R * 0.55, Math.cos(a + 0.9) * R * 0.8, Math.sin(a + 0.9) * R * 0.8); ctx.stroke(); }
    ctx.restore();
    drawLabel(ctx, "ปั๊ม Pump", pumpX, pumpY + R + 13, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // motor + VFD
    const mW = R * 1.5, mH = R * 0.85;
    ctx.fillStyle = dark ? "rgba(30,58,95,0.6)" : "rgba(203,213,225,0.7)";
    ctx.fillRect(pumpX - mW / 2, pumpY - R - mH - 6, mW, mH);
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b"; ctx.lineWidth = 2; ctx.strokeRect(pumpX - mW / 2, pumpY - R - mH - 6, mW, mH);
    drawLabel(ctx, "มอเตอร์ M", pumpX, pumpY - R - mH / 2 - 6, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: "rgba(0,0,0,0)" });
    if (L.vfd) drawLabel(ctx, `VFD ${formatNumber(s.freq, 0)} Hz`, pumpX, pumpY - R - mH - 16, { align: "center", font: "bold 13px 'JetBrains Mono', monospace", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.8)" : "rgba(255,255,255,0.9)" });
    if (L.status) drawLabel(ctx, "● RUN", pumpX + mW * 0.7, pumpY - R - mH - 16, { align: "left", color: "#10b981", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // valves
    if (L.valve) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath(); ctx.moveTo(cvX - 6, pumpY - 9); ctx.lineTo(cvX + 6, pumpY); ctx.lineTo(cvX - 6, pumpY + 9); ctx.closePath(); ctx.fill();
      ctx.fillRect(gvX - 6, pumpY - 10, 12, 3); ctx.fillRect(gvX - 6, pumpY + 7, 12, 3);
      drawLabel(ctx, "เช็ควาล์ว", cvX, pumpY + 20, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });
      drawLabel(ctx, "เกตวาล์ว 100%", gvX, pumpY - 18, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });
    }

    // pressure points
    if (L.pressure) {
      const pt = (x: number, bar: number, label: string) => { ctx.beginPath(); ctx.arc(x, pumpY, 4, 0, Math.PI * 2); ctx.fillStyle = bar > 6 ? "#ef4444" : bar > 4 ? "#f59e0b" : "#22d3ee"; ctx.fill(); drawLabel(ctx, `${label} ${formatNumber(bar)} bar`, x, pumpY + 30, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)" }); };
      pt(pumpX - R - 18, s.psuc, "ดูด");
      pt(gvX + 16, s.pdis, "ส่ง");
    }

    // tank
    tankRef.current = approach(tankRef.current, 55 + s.lf * 20, 0.05);
    const lvl = clamp(tankRef.current / 100, 0, 1);
    ctx.fillStyle = dark ? "rgba(15,23,42,0.5)" : "rgba(226,232,240,0.55)"; ctx.fillRect(tankX, tankY, tankW, tankH);
    ctx.fillStyle = "rgba(56,189,248,0.5)";
    const wTop = tankY + tankH * (1 - lvl);
    ctx.beginPath(); ctx.moveTo(tankX, tankY + tankH); ctx.lineTo(tankX, wTop);
    for (let i = 0; i <= 10; i++) ctx.lineTo(tankX + (i / 10) * tankW, wTop + Math.sin(time * 2 + i) * 2);
    ctx.lineTo(tankX + tankW, tankY + tankH); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8"; ctx.lineWidth = 2.5; ctx.strokeRect(tankX, tankY, tankW, tankH);
    drawLabel(ctx, "ถังสูง Tank", tankX + tankW / 2, tankY - 8, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    if (L.sensor) drawLabel(ctx, `${formatNumber(tankRef.current, 0)}%`, tankX + tankW / 2, tankY + tankH * 0.5, { align: "center", font: "bold 13px 'JetBrains Mono', monospace", color: "#fff", bg: "rgba(8,13,24,0.55)" });
    drawArrow(ctx, tankX + tankW, tankY + tankH * 0.4, width - 6, tankY + tankH * 0.4, "#67e8f9", 2.5, 8);
    drawLabel(ctx, "จ่ายน้ำ", width - 8, tankY + tankH * 0.4 - 12, { align: "right", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });

    // sensor readouts (flow)
    if (L.sensor) drawLabel(ctx, `Q ${formatNumber(s.flowH, 0)} m³/h`, (gvX + tankX) / 2, pumpY - 16, { align: "center", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.9)" });

    // energy panel
    if (L.energy) {
      const ex = width * 0.04, ey = height * 0.05;
      ctx.fillStyle = dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.9)"; ctx.fillRect(ex, ey, 122, 38);
      ctx.strokeStyle = dark ? "#2a4a73" : "#cbd5e1"; ctx.lineWidth = 1; ctx.strokeRect(ex, ey, 122, 38);
      drawLabel(ctx, `⚡ ${formatNumber(s.powerKW)} kW`, ex + 8, ey + 13, { align: "left", font: "bold 12px 'JetBrains Mono', monospace", color: dark ? "#fcd34d" : "#b45309", bg: "rgba(0,0,0,0)" });
      const sec = s.flowH > 0 ? s.powerKW / s.flowH : 0;
      drawLabel(ctx, `${formatNumber(sec, 3)} kWh/m³`, ex + 8, ey + 28, { align: "left", color: dark ? "#e2e8f0" : "#0f172a", bg: "rgba(0,0,0,0)" });
    }
  };

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      <div className="lab-card p-3">
        <div className="mb-2 text-sm font-bold text-ink">ชั้นข้อมูล Layers</div>
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((l) => <ToggleChip key={l.key} label={l.label} icon={l.icon} active={layers[l.key]} onClick={() => toggle(l.key)} />)}
        </div>
      </div>
      <ExplanationPanel
        text={`สถานีจ่ายน้ำ ${formatNumber(flowH, 0)} m³/h · ปั๊มเดินที่ VFD ${formatNumber(freq, 0)} Hz · ความดันส่ง ${formatNumber(pdis)} bar · กำลัง ${formatNumber(powerKW)} kW — เปิด/ปิด layer เพื่อดูข้อมูลแต่ละชั้นเหมือนหน้าจอ SCADA`}
        badge={{ label: "ภาพรวมระบบ", tone: "cyan" }}
      />
      <section className="rounded-xl border border-flow-500/30 bg-gradient-to-br from-flow-500/[0.08] to-iris-500/[0.06] p-3.5">
        <h3 className="text-sm font-bold text-flow-700 dark:text-flow-200">🏭 องค์ประกอบหลัก</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          <b>บ่อพัก</b> เก็บน้ำต้นทาง · <b>ปั๊ม</b> เพิ่มหัว (head) · <b>มอเตอร์+VFD</b> ขับและคุมรอบ · <b>เช็ควาล์ว</b> กันน้ำไหลกลับ · <b>เกตวาล์ว</b> เปิด-ปิดสาย · <b>ถังสูง</b> เก็บ/รักษาแรงดัน · <b>เซนเซอร์</b> วัดความดัน/flow/ระดับ ส่งเข้า SCADA
        </p>
      </section>
      <a href="#/digital-twin" className="lab-card flex items-center gap-3 p-3 transition hover:ring-aurora">
        <span className="text-xl">🖥️</span>
        <div><div className="text-sm font-bold text-ink">เปิด Digital Twin เต็มระบบ →</div><div className="text-[11px] text-ink-soft">SCADA dashboard + สถานการณ์ผิดปกติ</div></div>
      </a>
    </>
  );

  return (
    <SimulationLayout
      title="ภาพรวมสถานีสูบจ่ายน้ำ"
      titleEn="Pump Station Overview — แผนผัง interactive เปิด/ปิด layer ได้"
      icon="🏭"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความต้องการใช้น้ำ" symbol="load" value={load} min={40} max={100} step={1} unit="%" decimals={0} onChange={(v) => setLoad(v)} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
          <p className="text-[11px] text-ink-faint">ใช้ปุ่ม Layers ทางขวาเพื่อแสดง/ซ่อนข้อมูลแต่ละชั้น</p>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-overview">
          <ParticleFlowCanvas draw={draw} playing={controls.playing} speed={controls.speed} theme={theme} className="block h-full w-full" ariaLabel="แผนผังสถานีสูบจ่ายน้ำแบบเคลื่อนไหวพร้อมชั้นข้อมูล" />
        </SimStage>
      }
      results={<div id="explain-overview">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
