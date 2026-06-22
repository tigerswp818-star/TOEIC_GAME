import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { BarChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { RHO_WATER } from "@/lib/constants";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel, roundRect } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  DEVICES,
  DEVICE_INFO,
  DEVICE_BY_INDEX,
  LOSS_PITOT,
  LOSS_VENTURI,
  LOSS_ORIFICE,
  computeMeter,
  deltaPForVelocity,
  areaFracAt,
  velocityFracAt,
  maxVelocityFrac,
  seedParticles,
  TAP_UP,
  TAP_DOWN,
  STATION,
  type DeviceKind,
  type MeterParticle,
} from "./flowMeterModel";

const PARTICLE_COUNT = 200;
const SPEED = 0.06; // normalised xf per second per (m/s)

interface Params {
  v: number;
  d1: number;
  beta: number;
}
const DEFAULTS: Params = { v: 3, d1: 0.1, beta: 0.5 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่หลอดพิโตต์ (Pitot)",
    body: "หลอดพิโตต์วัดผลต่างความดัน 'หยุดนิ่ง − สถิต' ที่จุดเดียว แล้วได้ความเร็วเฉพาะจุด V = √(2·ΔP/ρ) สังเกตหัววัดที่หันเข้าหากระแสและหลอดมาโนมิเตอร์เพียงหลอดเดียว",
    apply: { device: 0, v: 3, beta: 0.5 },
  },
  {
    title: "เปลี่ยนเป็นเวนทูรี (Venturi)",
    body: "เวนทูรีค่อย ๆ บีบท่อให้แคบลงอย่างนุ่มนวลแล้วขยายกลับ แท็ปวัดความดันก่อนคอท่อและที่คอท่อ คำนวณ Q จาก ΔP ด้วย Cd ≈ 0.98 — สูญเสียพลังงานน้อยเพราะการไหลไม่แยกตัว",
    apply: { device: 1, v: 3, beta: 0.5 },
  },
  {
    title: "เปลี่ยนเป็นออริฟิซ (Orifice)",
    body: "ออริฟิซคือแผ่นเจาะรูคมวางขวางท่อ การไหลพุ่งผ่านรูแล้วแยกตัว เกิด vena contracta และกระแสปั่นป่วนหลังแผ่น ทำให้ Cd ต่ำเพียง ≈ 0.62 และสูญเสียพลังงานถาวรสูงมาก",
    apply: { device: 2, v: 4, beta: 0.5 },
  },
  {
    title: "เทียบการสูญเสียพลังงาน",
    body: "เปิดกราฟเพื่อเทียบการสูญเสียความดันถาวรของทั้งสามอุปกรณ์ เวนทูรีแม่นและสูญเสียน้อยแต่ใหญ่/แพง ส่วนออริฟิซติดตั้งง่าย/ถูกแต่สูญเสียสูง นี่คือการแลกเปลี่ยน (trade-off) ของการเลือกเครื่องวัด",
    apply: { device: 2, v: 5, beta: 0.6 },
  },
];

const challenges: Challenge[] = [
  {
    id: "lowloss",
    title: "เลือกอุปกรณ์ที่สูญเสียพลังงานถาวรน้อยที่สุด (เลือกเวนทูรี)",
    hint: "เวนทูรีมีการไหลที่นุ่มนวล ไม่แยกตัว จึงคืนความดันได้มากและสูญเสียน้อยที่สุดในกลุ่มที่วัดอัตราการไหล",
    isSolved: (r) => r.deviceIndex === 1,
    success: "ถูกต้อง! เวนทูรีสูญเสียพลังงานน้อยที่สุด เหมาะกับงานที่ต้องประหยัดพลังงาน",
  },
  {
    id: "targetdp",
    title: "ทำให้เครื่องวัดอ่านค่า ΔP ≥ 8,000 Pa",
    hint: "ΔP เพิ่มเมื่อความเร็ว V สูงขึ้น หรือเมื่อบีบคอท่อ (β เล็กลง) สำหรับเวนทูรี/ออริฟิซ",
    isSolved: (r) => r.dp >= 8000 - 1e-6,
    success: "เยี่ยม! ΔP ถึงเป้าหมายแล้ว — ความเร็วยิ่งสูง ผลต่างความดันที่วัดได้ยิ่งมาก",
  },
  {
    id: "orificecd",
    title: "เลือกออริฟิซแล้วสังเกต Cd ต่ำ (ได้ผลต่างความดันมากที่ V เท่ากัน)",
    hint: "สลับมาที่ออริฟิซ ที่ความเร็วเท่ากันมันต้องอ่าน ΔP มากกว่าเวนทูรี เพราะ Cd ต่ำกว่า (0.62 < 0.98)",
    isSolved: (r) => r.deviceIndex === 2,
    success: "ใช่เลย! ออริฟิซ Cd ≈ 0.62 ต่ำกว่าเวนทูรีมาก เพราะการไหลแยกตัวที่ขอบรูคม",
  },
];

const quiz: QuizItem[] = [
  {
    question: "อุปกรณ์วัดอัตราการไหลชนิดใดต่อไปนี้สูญเสียพลังงาน (ความดันถาวร) มากที่สุด?",
    choices: ["หลอดพิโตต์", "เวนทูรีมิเตอร์", "ออริฟิซมิเตอร์", "สูญเสียเท่ากันหมด"],
    answer: 2,
    explain: "ออริฟิซเป็นแผ่นเจาะรูคม การไหลพุ่งผ่านแล้วแยกตัวเกิดกระแสปั่นป่วนหลังแผ่น พลังงานจึงสูญเสียถาวรมากที่สุด ต่างจากเวนทูรีที่ค่อย ๆ ขยายและคืนความดันได้ดี",
  },
  {
    question: "หลอดพิโตต์ (Pitot tube) วัดอะไร?",
    choices: [
      "อัตราการไหลรวมทั้งท่อโดยตรง",
      "ความเร็วของไหลเฉพาะจุดจากผลต่างความดันหยุดนิ่ง−สถิต",
      "ความหนาแน่นของของไหล",
      "อุณหภูมิของของไหล",
    ],
    answer: 1,
    explain: "หลอดพิโตต์วัดผลต่างระหว่างความดันหยุดนิ่ง (stagnation) กับความดันสถิต แล้วได้ความเร็วเฉพาะจุด V = √(2·ΔP/ρ) ไม่ได้วัดอัตราการไหลทั้งท่อโดยตรง",
  },
  {
    question: "ทำไมค่าสัมประสิทธิ์การไหล Cd ของออริฟิซจึงต่ำกว่าเวนทูรี?",
    choices: [
      "เพราะออริฟิซมีราคาแพงกว่า",
      "เพราะของไหลผ่านออริฟิซเร็วกว่าเสมอ",
      "เพราะการไหลแยกตัวที่ขอบรูคมเกิด vena contracta พื้นที่ไหลจริงเล็กกว่าและมีการสูญเสีย",
      "เพราะออริฟิซวัด ΔP ไม่ได้",
    ],
    answer: 2,
    explain: "ที่ขอบรูคมของออริฟิซ การไหลแยกตัวและหดตัวเป็น vena contracta พื้นที่ไหลจริงเล็กกว่าพื้นที่รูและมีการสูญเสียพลังงาน Cd จึงต่ำ (~0.62) ขณะที่เวนทูรีไหลแนบผนัง Cd สูง (~0.98)",
  },
];

export default function FlowMeterSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [device, setDevice] = useState<DeviceKind>("venturi");
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<MeterParticle[]>(seedParticles(PARTICLE_COUNT));

  const result = computeMeter(device, params.v, params.d1, params.beta, RHO_WATER);
  const info = DEVICE_INFO[device];
  const deviceIndex = DEVICES.indexOf(device);
  const isPitot = device === "pitot";

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));

  // Guided presets carry a numeric `device` sentinel so they can also switch the
  // active meter (the shared GuidedSteps component only passes numbers).
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.device === "number") {
      setDevice(DEVICE_BY_INDEX[vals.device] ?? "venturi");
    }
    setParams((p) => ({
      ...p,
      ...(typeof vals.v === "number" ? { v: vals.v } : {}),
      ...(typeof vals.d1 === "number" ? { d1: vals.d1 } : {}),
      ...(typeof vals.beta === "number" ? { beta: vals.beta } : {}),
    }));
  };

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { v, beta } = params;
    const dark = t === "dark";
    const centerY = height * 0.58;
    const maxHalf = height * 0.26;
    const halfAt = (xf: number) => maxHalf * areaFracAt(xf, device, beta);
    const maxVel = maxVelocityFrac(device, beta);

    const steps = 80;
    const topY = (xf: number) => centerY - halfAt(xf);
    const botY = (xf: number) => centerY + halfAt(xf);

    // --- outer pipe walls (full bore for pitot/orifice, contoured for venturi) ---
    const wallHalf = maxHalf;
    ctx.fillStyle = dark ? "rgba(14,116,144,0.12)" : "rgba(165,243,252,0.30)";
    ctx.fillRect(0, centerY - wallHalf, width, wallHalf * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";

    if (device === "venturi") {
      // contoured venturi body
      ctx.beginPath();
      ctx.moveTo(0, topY(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, topY(i / steps));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, botY(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, botY(i / steps));
      ctx.stroke();
    } else {
      // straight full-bore pipe
      ctx.beginPath();
      ctx.moveTo(0, centerY - wallHalf);
      ctx.lineTo(width, centerY - wallHalf);
      ctx.moveTo(0, centerY + wallHalf);
      ctx.lineTo(width, centerY + wallHalf);
      ctx.stroke();
    }

    // --- the active device geometry on the pipe ---
    const stationX = STATION * width;
    if (device === "orifice") {
      // sharp plate with a hole of half-height = wallHalf·β
      const holeHalf = wallHalf * beta;
      ctx.fillStyle = dark ? "#334155" : "#64748b";
      ctx.fillRect(stationX - 4, centerY - wallHalf, 8, wallHalf - holeHalf);
      ctx.fillRect(stationX - 4, centerY + holeHalf, 8, wallHalf - holeHalf);
    } else if (device === "pitot") {
      // L-shaped probe facing the flow (its mouth points upstream)
      const tipX = stationX;
      ctx.strokeStyle = dark ? "#e2e8f0" : "#0f172a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tipX, centerY);
      ctx.lineTo(tipX + 14, centerY);
      ctx.lineTo(tipX + 14, centerY - wallHalf - 24);
      ctx.stroke();
      ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
      ctx.beginPath();
      ctx.arc(tipX, centerY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    }

    // --- particles (speed & colour ∝ local velocity) ---
    const particles = particlesRef.current;
    const orificeTurb = device === "orifice";
    for (const p of particles) {
      const velFrac = velocityFracAt(p.xf, device, beta);
      let nx = p.xf + velFrac * v * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        p.f = (Math.random() * 2 - 1) * 0.92;
        p.seed = Math.random() * Math.PI * 2;
      }
      p.xf = nx;

      if (controls.toggles.particles) {
        // base streamline fraction is squeezed by the local area contraction.
        let frac = p.f * areaFracAt(p.xf, device, beta);
        // downstream of an orifice plate the jet separates → turbulent jitter.
        if (orificeTurb && p.xf > STATION && p.xf < 0.92) {
          const turb = (p.xf - STATION) / (0.92 - STATION);
          frac += Math.sin(p.seed + p.xf * 30) * 0.5 * turb * Math.min(1, areaFracAt(p.xf, device, beta) + 0.3);
        }
        frac = clamp(frac, -0.95, 0.95);
        const y = centerY + frac * wallHalf;
        const x = p.xf * width;
        const tNorm = Math.min(1, velFrac / maxVel);
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(tNorm, 0.95);
        ctx.fill();
      }
    }

    // --- velocity vectors ---
    if (controls.toggles.vectors) {
      const samples = [0.14, 0.3, 0.5, 0.7, 0.86];
      const vecPx = width * 0.04;
      for (const xf of samples) {
        const vel = velocityFracAt(xf, device, beta) * v;
        const x = xf * width;
        const len = Math.min(width * 0.16, vel * vecPx);
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.5, 8);
      }
    }

    // --- pressure taps + manometer columns (toggle) ---
    if (controls.toggles.pressure) {
      const rho = RHO_WATER;
      // The two stations whose pressures we contrast. Pitot reads the stagnation
      // (high) vs static (low) pair at a single point; the others read up- vs throat.
      const dp = deltaPForVelocity(device, v, rho, beta);
      const tubeW = Math.max(14, width * 0.04);
      const wideTop = centerY - wallHalf;
      // Reserve ~46 px above the pipe for the tube top + its label so neither
      // clips off the top edge of the canvas.
      const maxColPx = Math.max(24, wideTop - 46);

      // The "high" column is full; the "low" column drops by an amount ∝ ΔP.
      // Scale ΔP onto the available column height (cap so it never clips).
      const dpRef = 12000; // Pa → roughly full deflection
      const dropFrac = clamp(dp / dpRef, 0, 0.9);

      const tubes: { x: number; drop: number; label: string }[] = isPitot
        ? [
            { x: STATION - 0.13, drop: dropFrac, label: "สถิต Static" },
            { x: STATION + 0.06, drop: 0, label: "หยุดนิ่ง Stagnation" },
          ]
        : [
            { x: TAP_UP, drop: 0, label: "ก่อนคอท่อ" },
            { x: TAP_DOWN, drop: dropFrac, label: device === "orifice" ? "หลังแผ่น" : "ที่คอท่อ" },
          ];

      for (const tube of tubes) {
        const x = tube.x * width;
        const colPx = maxColPx * (1 - tube.drop);
        const pipeTop = centerY - wallHalf;
        const tubeTopY = pipeTop - maxColPx - 12;
        const tubeBottomY = pipeTop;
        const tubeX = x - tubeW / 2;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = dark ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.8)";
        ctx.fillStyle = dark ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.55)";
        roundRect(ctx, tubeX, tubeTopY, tubeW, tubeBottomY - tubeTopY, 5);
        ctx.fill();
        ctx.stroke();

        const fillTopY = tubeBottomY - colPx;
        ctx.fillStyle = dark ? "rgba(56,189,248,0.7)" : "rgba(14,165,233,0.7)";
        ctx.beginPath();
        roundRect(ctx, tubeX + 2, fillTopY, tubeW - 4, tubeBottomY - fillTopY, 3);
        ctx.fill();
        ctx.restore();

        // tap connector line down to the pipe
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = dark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, tubeBottomY);
        ctx.lineTo(x, centerY);
        ctx.stroke();
        ctx.restore();

        drawLabel(ctx, tube.label, x, tubeTopY - 10, {
          align: "center",
          color: dark ? "#e2e8f0" : "#0f172a",
          bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
        });
      }

      // ΔP readout near the station
      drawLabel(ctx, `ΔP = ${formatNumber(dp, 0)} Pa`, stationX, botY(STATION) + 22, {
        align: "center",
        color: "#fde68a",
        bg: "rgba(120,53,15,0.85)",
      });
    }
  };

  const explanation = isPitot
    ? `หลอดพิโตต์วัดผลต่างความดันหยุดนิ่ง−สถิตที่จุดเดียว (ΔP = ${formatNumber(result.dp, 0)} Pa) แล้วได้ความเร็วเฉพาะจุด V = √(2·ΔP/ρ) = ${formatNumber(result.vMeasured)} m/s — วัดความเร็วเฉพาะจุด ราคาถูก`
    : device === "venturi"
      ? `เวนทูรีบีบท่ออย่างนุ่มนวลแล้ววัด ΔP = ${formatNumber(result.dp, 0)} Pa ระหว่างก่อนคอท่อกับคอท่อ ได้ Q = Cd·A₂·√(2·ΔP/(ρ(1−β⁴))) = ${formatNumber(result.q)} m³/s ด้วย Cd = ${formatNumber(result.cd ?? 0)} — แม่นยำ สูญเสียพลังงานน้อย แต่ใหญ่/แพง`
      : `ออริฟิซคือแผ่นเจาะรูคม การไหลแยกตัวเกิด vena contracta และกระแสปั่นป่วนหลังแผ่น ทำให้ Cd ต่ำเพียง ${formatNumber(result.cd ?? 0)} ที่ ΔP = ${formatNumber(result.dp, 0)} Pa ได้ Q = ${formatNumber(result.q)} m³/s — ติดตั้งง่าย/ถูก แต่สูญเสียพลังงานสูงและ Cd ต่ำ`;

  const availableToggles = ["particles", "vectors", "pressure", "graph", "formula"] as const;

  const lossBars = [
    { label: "Pitot", value: LOSS_PITOT * 100, color: device === "pitot" ? "#06b6d4" : "#94a3b8" },
    { label: "Venturi", value: LOSS_VENTURI * 100, color: device === "venturi" ? "#06b6d4" : "#94a3b8" },
    { label: "Orifice", value: LOSS_ORIFICE * 100, color: device === "orifice" ? "#06b6d4" : "#94a3b8" },
  ];

  const formula = isPitot
    ? "V = √( 2·ΔP / ρ )"
    : "Q = Cd·A₂·√( 2·ΔP / (ρ·(1 − (A₂/A₁)²)) )";
  const substituted = isPitot
    ? `√( 2 × ${formatNumber(result.dp, 0)} / ${formatNumber(RHO_WATER, 0)} ) = ${formatNumber(result.vMeasured)} m/s`
    : `${formatNumber(result.cd ?? 0)} × ${formatNumber(result.a2, 4)} × √( 2 × ${formatNumber(result.dp, 0)} / (${formatNumber(RHO_WATER, 0)}·(1 − ${formatNumber(params.beta ** 4)})) ) = ${formatNumber(result.q)} m³/s`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ q: result.q, dp: result.dp, deviceIndex }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {isPitot ? (
          <ResultStat
            label="ความเร็วที่วัดได้ V"
            value={result.vMeasured}
            unit="m/s"
            big
            accentClass="text-flow-600 dark:text-flow-300"
          />
        ) : (
          <ResultStat
            label="อัตราการไหลที่วัดได้ Q"
            value={result.q}
            unit="m³/s"
            big
            accentClass="text-flow-600 dark:text-flow-300"
          />
        )}
        <ResultStat label="ผลต่างความดัน ΔP" value={result.dp} unit="Pa" decimals={0} />
        <ResultStat
          label="สัมประสิทธิ์การไหล Cd"
          value={result.cd === null ? "—" : result.cd}
          unit={result.cd === null ? "" : "—"}
        />
        <ResultStat label="อุปกรณ์ Device" value={info.nameTh} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: info.label, tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={formula}
          substituted={substituted}
          variables={[
            { symbol: "ΔP", meaning: "ผลต่างความดันที่วัดได้ Pressure difference", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Density", unit: "kg/m³" },
            { symbol: "Cd", meaning: "สัมประสิทธิ์การไหล Discharge coeff.", unit: "—" },
            { symbol: "A₁", meaning: "พื้นที่ท่อ Pipe area", unit: "m²" },
            { symbol: "A₂", meaning: "พื้นที่คอ/รู Throat area", unit: "m²" },
            { symbol: "β", meaning: "อัตราส่วนคอด D₂/D₁ Diameter ratio", unit: "—" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            A₁ = {formatNumber(result.a1, 4)} m² · A₂ = {formatNumber(result.a2, 4)} m²
            {!isPitot && ` · Cd เวนทูรี ≈ 0.98, ออริฟิซ ≈ 0.62`}
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="การสูญเสียความดันถาวร (% ของ ΔP) ของแต่ละอุปกรณ์">
          <BarChart unit="%" max={100} bars={lossBars} />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 อุปกรณ์ที่เลือก · Pitot น้อยสุด · Orifice มากสุด — เทรดออฟระหว่างความถูก/ติดตั้งง่าย กับการสูญเสียพลังงาน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เครื่องวัดอัตราการไหล"
      titleEn="Flow Meter Comparison"
      icon="📟"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-2">
            <span className="text-sm font-medium text-ink">อุปกรณ์วัด Device</span>
            <div className="flex flex-wrap gap-2">
              {DEVICES.map((d) => (
                <ToggleChip
                  key={d}
                  label={DEVICE_INFO[d].label}
                  icon={DEVICE_INFO[d].icon}
                  active={device === d}
                  onClick={() => setDevice(d)}
                />
              ))}
            </div>
          </div>

          <ControlSlider
            label="ความเร็วของไหล"
            symbol="V"
            value={params.v}
            min={0.5}
            max={10}
            step={0.1}
            unit="m/s"
            decimals={1}
            onChange={set("v")}
          />
          <ControlSlider
            label="เส้นผ่านศูนย์กลางท่อ"
            symbol="D₁"
            value={params.d1}
            min={0.05}
            max={0.4}
            step={0.01}
            unit="m"
            decimals={2}
            onChange={set("d1")}
          />
          {!isPitot && (
            <ControlSlider
              label="อัตราส่วนคอด D₂/D₁"
              symbol="β"
              value={params.beta}
              min={0.3}
              max={0.8}
              step={0.01}
              unit="—"
              decimals={2}
              onChange={set("beta")}
            />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-flowmeter">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="แผนภาพเครื่องวัดอัตราการไหล (พิโตต์/เวนทูรี/ออริฟิซ) พร้อมอนุภาคไหลและหลอดมาโนมิเตอร์แสดงผลต่างความดัน"
          />
        </SimStage>
      }
      results={<div id="explain-flowmeter">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
