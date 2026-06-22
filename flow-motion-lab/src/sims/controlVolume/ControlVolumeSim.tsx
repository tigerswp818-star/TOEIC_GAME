import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { LineChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber } from "@/lib/math";
import { depthColor, velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle } from "@/lib/render/draw";
import { RHO_WATER } from "@/lib/constants";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  integrateLevel,
  massBalance,
  seedStream,
  stateLabel,
  type StreamParticle,
} from "./controlVolumeModel";

interface Params {
  qin1: number; // m³/s
  qin2: number; // m³/s
  qout: number; // m³/s
  aTank: number; // m²
}
const DEFAULTS: Params = { qin1: 0.2, qin2: 0.1, qout: 0.3, aTank: 2 };

/** Initial fill fraction shown when the sim (re)starts. */
const INITIAL_LEVEL = 0.45;
/** Reference volume (m³) of a completely full tank — sets the visual fill pace. */
const FULL_VOLUME = 1.0;
/** History window (seconds) kept for the level-vs-time line chart. */
const HISTORY_SECONDS = 30;

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากสมดุล (steady)",
    body: "ตั้งให้ผลรวมของ inflow เท่ากับ outflow พอดี (ΣQin = Qout) สังเกตว่าระดับน้ำใน control volume นิ่งอยู่กับที่ เพราะของไหลที่เข้ามาเท่ากับที่ไหลออก",
    apply: { qin1: 0.2, qin2: 0.1, qout: 0.3, aTank: 2 },
  },
  {
    title: "เพิ่ม inflow ให้มากกว่า outflow",
    body: "เพิ่ม Qin1 และ Qin2 จนผลรวม inflow มากกว่า outflow ตอนนี้ dV/dt เป็นบวก ของไหลสะสมเพิ่มขึ้น ระดับน้ำค่อย ๆ สูงขึ้นจนเต็มถัง",
    apply: { qin1: 0.4, qin2: 0.3, qout: 0.2, aTank: 2 },
  },
  {
    title: "ทำให้ outflow มากกว่า inflow",
    body: "เพิ่ม Qout ให้มากกว่าผลรวม inflow ตอนนี้ dV/dt เป็นลบ ของไหลถูกระบายออกเร็วกว่าที่เข้ามา ระดับน้ำจึงลดลงจนถังว่าง",
    apply: { qin1: 0.1, qin2: 0.05, qout: 0.6, aTank: 2 },
  },
  {
    title: "สรุปหลักอนุรักษ์มวล",
    body: "อัตราการสะสม dV/dt = ΣQin − Qout และอัตราเชิงมวล ṁ = ρ·dV/dt ถ้าเข้ามากกว่าออกระดับสูงขึ้น เท่ากันคงที่ ออกมากกว่าเข้าระดับลด — นี่คือสมการอนุรักษ์มวลของ control volume",
  },
];

const challenges: Challenge[] = [
  {
    id: "steady",
    title: "ทำให้ระบบสมดุล (|dV/dt| ≈ 0)",
    hint: "ปรับให้ผลรวม inflow (Qin1 + Qin2) เท่ากับ Qout พอดี",
    isSolved: (r) => Math.abs(r.net) < 0.01,
    success: "สำเร็จ! inflow = outflow ระดับน้ำจึงนิ่ง (steady state)",
  },
  {
    id: "fill",
    title: "ทำให้ถังเติมจนเกือบเต็ม (ระดับ ≥ 90%)",
    hint: "ทำให้ inflow มากกว่า outflow ชัด ๆ แล้วรอให้ระดับน้ำสูงขึ้น",
    isSolved: (r) => r.net > 0.02 && r.level >= 0.9,
    success: "เยี่ยม! inflow ชนะ outflow ของไหลสะสมจนถังเกือบเต็ม",
  },
  {
    id: "empty",
    title: "ระบายถังให้เกือบหมด (ระดับ ≤ 10%)",
    hint: "ทำให้ Qout มากกว่าผลรวม inflow แล้วรอให้ระดับน้ำลดลง",
    isSolved: (r) => r.net < -0.02 && r.level <= 0.1,
    success: "ใช่เลย! outflow ชนะ inflow ของไหลถูกระบายออกจนถังเกือบว่าง",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ระดับน้ำใน control volume จะ 'นิ่ง' (steady) เมื่อใด?",
    choices: [
      "เมื่อผลรวม inflow เท่ากับ outflow (ΣQin = Qout)",
      "เมื่อ inflow มากกว่า outflow",
      "เมื่อ outflow มากกว่า inflow",
      "เมื่อปิดท่อทั้งหมด",
    ],
    answer: 0,
    explain:
      "ระดับนิ่งเมื่อ dV/dt = ΣQin − Qout = 0 นั่นคือของไหลที่เข้ามาเท่ากับที่ไหลออกพอดี ปริมาตรในถังจึงไม่เปลี่ยน",
  },
  {
    question: "ค่า dV/dt ที่เป็นบวก (net > 0) หมายความว่าอะไร?",
    choices: [
      "ของไหลกำลังสะสมเพิ่มขึ้น ระดับน้ำสูงขึ้น",
      "ของไหลกำลังลดลง ระดับน้ำต่ำลง",
      "ปริมาตรในถังคงที่",
      "ความดันลดลง",
    ],
    answer: 0,
    explain:
      "dV/dt คืออัตราการสะสมปริมาตร ถ้าเป็นบวกแปลว่า inflow > outflow ของไหลในถังเพิ่มขึ้น ระดับน้ำจึงสูงขึ้น",
  },
  {
    question: "สมการ ṁ = ρ·dV/dt สะท้อนหลักการใด?",
    choices: [
      "การอนุรักษ์มวล (Conservation of mass)",
      "การอนุรักษ์โมเมนตัม",
      "กฎของบอยล์",
      "แรงตึงผิว",
    ],
    answer: 0,
    explain:
      "อัตราการสะสมมวลในถัง = มวลที่เข้า − มวลที่ออก เมื่อของไหลอัดตัวไม่ได้ ṁ = ρ·(ΣQin − Qout) นี่คือสมการอนุรักษ์มวลของ control volume",
  },
];

export default function ControlVolumeSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  // Surfaced live level (0..1) for challenge predicates + readouts.
  const [level, setLevel] = useState(INITIAL_LEVEL);

  const levelRef = useRef(INITIAL_LEVEL);
  const inStream1 = useRef<StreamParticle[]>(seedStream(36));
  const inStream2 = useRef<StreamParticle[]>(seedStream(36));
  const outStream = useRef<StreamParticle[]>(seedStream(36));
  // Rolling history of {time, level} for the line chart.
  const historyRef = useRef<{ x: number; y: number }[]>([]);
  const [history, setHistory] = useState<{ x: number; y: number }[]>([]);

  const balance = massBalance(params.qin1, params.qin2, params.qout, RHO_WATER);
  const { inflow, net, massRate, state } = balance;

  // Re-init level, streams and history on Reset.
  useEffect(() => {
    levelRef.current = INITIAL_LEVEL;
    setLevel(INITIAL_LEVEL);
    inStream1.current = seedStream(36);
    inStream2.current = seedStream(36);
    outStream.current = seedStream(36);
    historyRef.current = [];
    setHistory([]);
  }, [controls.resetNonce]);

  // Surface level + history to React state ~5×/second (cheap, off the RAF loop).
  useEffect(() => {
    const id = setInterval(() => {
      setLevel(levelRef.current);
      setHistory([...historyRef.current]);
    }, 200);
    return () => clearInterval(id);
  }, []);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: Math.max(0, v) }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";

    // --- integrate the water level by dt (frozen when paused) ---
    levelRef.current = integrateLevel(
      levelRef.current,
      net,
      params.aTank,
      dt,
      FULL_VOLUME,
    );
    // Record history (normalised seconds since the chart only needs the shape).
    if (dt > 0) {
      const h = historyRef.current;
      const last = h.length ? h[h.length - 1].x : 0;
      const tx = last + dt;
      h.push({ x: tx, y: levelRef.current });
      const cutoff = tx - HISTORY_SECONDS;
      while (h.length > 1 && h[0].x < cutoff) h.shift();
    }
    const lvl = levelRef.current;

    // --- tank (control volume) geometry ---
    const tankLeft = width * 0.26;
    const tankRight = width * 0.74;
    const tankTop = height * 0.16;
    const tankBottom = height * 0.92;
    const tankW = tankRight - tankLeft;
    const tankH = tankBottom - tankTop;
    const surfacePx = tankBottom - lvl * tankH;

    // --- water body (depth shaded) ---
    if (lvl > 0.001) {
      const bands = 30;
      for (let i = 0; i < bands; i++) {
        const f0 = i / bands;
        const f1 = (i + 1) / bands;
        const y0 = surfacePx + f0 * (tankBottom - surfacePx);
        const y1 = surfacePx + f1 * (tankBottom - surfacePx);
        ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
        ctx.fillRect(tankLeft, y0, tankW, y1 - y0 + 1);
      }
      // surface wave line
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
      const segs = 48;
      for (let i = 0; i <= segs; i++) {
        const xf = i / segs;
        const x = tankLeft + xf * tankW;
        const y = surfacePx + Math.sin(time * 1.6 + xf * 9) * 2.2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // --- tank walls (open top) ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(tankLeft, tankTop);
    ctx.lineTo(tankLeft, tankBottom);
    ctx.lineTo(tankRight, tankBottom);
    ctx.lineTo(tankRight, tankTop);
    ctx.stroke();

    // --- pipe geometry ---
    const pipeColor = dark ? "#475569" : "#cbd5e1";
    const in1Y = tankTop + tankH * 0.12; // inflow 1 from the left, upper
    const in2X = tankLeft + tankW * 0.42; // inflow 2 from the top
    const in2Drop = tankTop; // where the top pipe meets the tank
    const outY = tankBottom - tankH * 0.08; // outflow on the right, low

    // inflow pipe 1 (left → into tank)
    ctx.fillStyle = pipeColor;
    ctx.fillRect(tankLeft - width * 0.18, in1Y - 9, width * 0.18, 18);
    // inflow pipe 2 (top → into tank)
    ctx.fillRect(in2X - 9, in2Drop - height * 0.12, 18, height * 0.12);
    // outflow pipe (right ← out of tank)
    ctx.fillRect(tankRight, outY - 9, width * 0.18, 18);

    // --- particle emission rate scales with the flow rate ---
    // map a flow rate (m³/s) to a per-second progress speed along the pipe.
    const speedFor = (q: number) => 0.25 + q * 1.6;

    // helper: advance & draw a stream of particles between two pixel points.
    const drawInStream = (
      stream: StreamParticle[],
      q: number,
      from: { x: number; y: number },
      to: { x: number; y: number },
      halfW: number,
      horizontal: boolean,
      vmax: number,
    ) => {
      const active = q > 1e-4;
      const sp = speedFor(q);
      const visible = Math.round(stream.length * Math.min(1, q / 0.5));
      let idx = 0;
      for (const p of stream) {
        p.t += sp * dt;
        if (p.t > 1) {
          p.t -= 1;
          p.j = Math.random() * 2 - 1;
        }
        if (!controls.toggles.particles || !active || idx >= visible) {
          idx++;
          continue;
        }
        idx++;
        const x = from.x + (to.x - from.x) * p.t + (horizontal ? 0 : p.j * halfW);
        const y = from.y + (to.y - from.y) * p.t + (horizontal ? p.j * halfW : 0);
        const tN = Math.min(1, q / vmax);
        const mb = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const trail = Math.min(tN * 16, 16);
        drawFlowParticle(ctx, x, y, (to.x - from.x) / mb, (to.y - from.y) / mb, velocityRampRGB(tN), {
          radius: 2.4,
          trail,
          alpha: 0.88,
          glow: tN > 0.6,
        });
      }
    };

    const vmaxIn = 0.5;
    // inflow 1: travels along the left pipe into the tank interior
    drawInStream(
      inStream1.current,
      params.qin1,
      { x: tankLeft - width * 0.18, y: in1Y },
      { x: tankLeft + tankW * 0.2, y: in1Y },
      7,
      true,
      vmaxIn,
    );
    // inflow 2: drops from the top pipe into the tank
    drawInStream(
      inStream2.current,
      params.qin2,
      { x: in2X, y: in2Drop - height * 0.12 },
      { x: in2X, y: Math.min(surfacePx, tankTop + tankH * 0.25) },
      7,
      false,
      vmaxIn,
    );
    // outflow: drains from the tank out through the right pipe
    drawInStream(
      outStream.current,
      params.qout,
      { x: tankRight - tankW * 0.12, y: outY },
      { x: tankRight + width * 0.18, y: outY },
      7,
      true,
      0.8,
    );

    // --- pipe labels ---
    drawLabel(ctx, "Qin1", tankLeft - width * 0.17, in1Y - 16, {
      color: dark ? "#a5f3fc" : "#0e7490",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "Qin2", in2X + 12, in2Drop - height * 0.06, {
      color: dark ? "#a5f3fc" : "#0e7490",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "Qout", tankRight + width * 0.02, outY - 16, {
      color: dark ? "#fbbf24" : "#b45309",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- net rate + rising/falling/steady indicator ---
    const arrow = state === "rising" ? "▲" : state === "falling" ? "▼" : "■";
    const indColor =
      state === "rising"
        ? dark
          ? "#34d399"
          : "#059669"
        : state === "falling"
          ? dark
            ? "#fb7185"
            : "#e11d48"
          : dark
            ? "#94a3b8"
            : "#475569";
    drawLabel(
      ctx,
      `${arrow} dV/dt = ${net >= 0 ? "+" : ""}${formatNumber(net)} m³/s`,
      (tankLeft + tankRight) / 2,
      tankTop - 14,
      {
        align: "center",
        color: "#ffffff",
        bg: indColor,
      },
    );
  };

  const tone: "cyan" | "emerald" | "rose" =
    state === "rising" ? "emerald" : state === "falling" ? "rose" : "cyan";
  const badgeLabel =
    state === "rising"
      ? "กำลังเพิ่ม Rising"
      : state === "falling"
        ? "กำลังลด Falling"
        : "คงที่ Steady";

  const explanation =
    state === "rising"
      ? `inflow รวม (ΣQin = ${formatNumber(inflow)} m³/s) มากกว่า outflow (Qout = ${formatNumber(
          params.qout,
        )} m³/s) ของไหลใน control volume จึงสะสมเพิ่มขึ้น dV/dt = +${formatNumber(
          net,
        )} m³/s ระดับน้ำสูงขึ้น — นี่คือหลักอนุรักษ์มวล`
      : state === "falling"
        ? `outflow (Qout = ${formatNumber(params.qout)} m³/s) มากกว่า inflow รวม (ΣQin = ${formatNumber(
            inflow,
          )} m³/s) ของไหลถูกระบายออกเร็วกว่าที่เข้ามา dV/dt = ${formatNumber(
            net,
          )} m³/s ระดับน้ำลดลง/ถังกำลังว่าง — นี่คือหลักอนุรักษ์มวล`
        : `inflow รวมเท่ากับ outflow พอดี (ΣQin ≈ Qout = ${formatNumber(
            params.qout,
          )} m³/s) ของไหลที่เข้าเท่ากับที่ออก dV/dt ≈ 0 ระดับน้ำคงที่ (steady) — ถ้า inflow มากกว่า outflow ของไหลจะสะสมเพิ่มขึ้น (ระดับสูงขึ้น) ถ้าเท่ากันระดับคงที่ นี่คือหลักอนุรักษ์มวล`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ net, inflow, outflow: params.qout, level }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="การสะสมสุทธิ dV/dt"
          value={net}
          unit="m³/s"
          big
          accentClass={
            state === "rising"
              ? "text-emerald-600 dark:text-emerald-300"
              : state === "falling"
                ? "text-rose-600 dark:text-rose-300"
                : "text-flow-600 dark:text-flow-300"
          }
        />
        <ResultStat
          label="สถานะ State"
          value={stateLabel(state)}
          accentClass={
            state === "rising"
              ? "text-emerald-600 dark:text-emerald-300"
              : state === "falling"
                ? "text-rose-600 dark:text-rose-300"
                : "text-flow-600 dark:text-flow-300"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="inflow รวม ΣQin" value={inflow} unit="m³/s" accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="outflow Qout" value={params.qout} unit="m³/s" accentClass="text-amber-600 dark:text-amber-300" />
        <ResultStat label="อัตราเชิงมวล ṁ" value={massRate} unit="kg/s" />
        <ResultStat label="ระดับน้ำ Level" value={level * 100} unit="%" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="dV/dt = ΣQin − ΣQout   ·   ṁ = ρ·Q"
          substituted={`dV/dt = (${formatNumber(params.qin1)} + ${formatNumber(
            params.qin2,
          )}) − ${formatNumber(params.qout)} = ${formatNumber(net)} m³/s   ·   ṁ = (${formatNumber(
            RHO_WATER,
            0,
          )})(${formatNumber(net)}) = ${formatNumber(massRate)} kg/s`}
          variables={[
            { symbol: "dV/dt", meaning: "อัตราการสะสมปริมาตร Net accumulation rate", unit: "m³/s" },
            { symbol: "Qin", meaning: "อัตราการไหลเข้า Inflow rate", unit: "m³/s" },
            { symbol: "Qout", meaning: "อัตราการไหลออก Outflow rate", unit: "m³/s" },
            { symbol: "ṁ", meaning: "อัตราการไหลเชิงมวล Mass flow rate", unit: "kg/s" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Fluid density", unit: "kg/m³" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ระดับน้ำในถังเทียบกับเวลา (Level vs time)">
          <LineChart
            series={[{ points: history.length ? history : [{ x: 0, y: level }], color: "#06b6d4" }]}
            xLabel="เวลา t (s)"
            yLabel="ระดับน้ำ (%)"
            domain={{
              xMin: history.length ? history[0].x : 0,
              xMax: history.length ? Math.max(history[history.length - 1].x, 1) : 1,
              yMin: 0,
              yMax: 1,
            }}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 ระดับน้ำ — เส้นชันขึ้น = กำลังเติม · ชันลง = กำลังระบาย · แนวราบ = steady
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="สมดุลมวลใน Control Volume"
      titleEn="Control Volume Mass Balance"
      icon="📦"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="อัตราไหลเข้า 1" symbol="Qin1" value={params.qin1} min={0} max={0.5} step={0.01} unit="m³/s" decimals={2} onChange={set("qin1")} />
          <ControlSlider label="อัตราไหลเข้า 2" symbol="Qin2" value={params.qin2} min={0} max={0.5} step={0.01} unit="m³/s" decimals={2} onChange={set("qin2")} />
          <ControlSlider label="อัตราไหลออก" symbol="Qout" value={params.qout} min={0} max={0.8} step={0.01} unit="m³/s" decimals={2} onChange={set("qout")} />
          <ControlSlider label="พื้นที่หน้าตัดถัง" symbol="A_tank" value={params.aTank} min={0.5} max={5} step={0.1} unit="m²" decimals={1} onChange={set("aTank")} />
          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-soft">
            ΣQin = {formatNumber(inflow)} m³/s · dV/dt = {net >= 0 ? "+" : ""}
            {formatNumber(net)} m³/s
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-controlvolume">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ถังควบคุมปริมาตรพร้อมท่อไหลเข้า 2 ท่อและท่อไหลออก 1 ท่อ ระดับน้ำเปลี่ยนตามสมดุลมวล"
          />
        </SimStage>
      }
      results={<div id="explain-controlvolume">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
