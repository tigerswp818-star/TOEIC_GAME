import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { reynoldsNumber, flowRegime, type FlowRegime } from "@/lib/fluidFormulas";
import { clamp, lerp, formatNumber, mapClamped } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, drawFlowParticle, type Pt } from "@/lib/render/draw";
import { REYNOLDS_LAMINAR_MAX, REYNOLDS_TURBULENT_MIN } from "@/lib/constants";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  turbulence,
  streamlineWave,
  seedParticles,
  seedEddies,
  type FlowParticle,
  type Eddy,
} from "./reynoldsModel";

const PARTICLE_COUNT = 180;
const EDDY_COUNT = 4;
const SPEED = 0.07; // normalised xf per second per (m/s)

interface Params {
  rho: number;
  v: number;
  d: number;
  mu: number;
}
const DEFAULTS: Params = { rho: 1000, v: 1.0, d: 0.05, mu: 0.001 };

/** Thai labels for each regime. */
const REGIME_LABEL: Record<FlowRegime, string> = {
  laminar: "Laminar",
  transitional: "Transitional",
  turbulent: "Turbulent",
};
const REGIME_TH: Record<FlowRegime, string> = {
  laminar: "ราบเรียบ",
  transitional: "เปลี่ยนผ่าน",
  turbulent: "ปั่นป่วน",
};
const REGIME_TONE: Record<FlowRegime, "emerald" | "amber" | "rose"> = {
  laminar: "emerald",
  transitional: "amber",
  turbulent: "rose",
};

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ของไหลหนืด — Laminar",
    body: "ตั้งความเร็ว V ต่ำและความหนืด μ สูง (ของไหลข้น เช่น น้ำมัน) ค่า Re จะน้อยกว่า 2300 การไหลเป็นแบบ Laminar เส้นการไหลเรียบขนานกัน เพราะแรงหนืด (viscous) ควบคุมการไหลได้ดี",
    apply: { rho: 1000, v: 0.4, d: 0.05, mu: 0.06 }, // Re ≈ 333
  },
  {
    title: "ลดความหนืด เข้าสู่ช่วง Transitional",
    body: "ค่อย ๆ ลดความหนืด μ (หรือเพิ่ม V) จน Re อยู่ระหว่าง 2300–4000 สังเกตว่าเส้นการไหลเริ่มสั่นและโยกไปมา การไหลกำลังจะเปลี่ยนเป็นปั่นป่วน",
    apply: { rho: 1000, v: 0.5, d: 0.05, mu: 0.01 }, // Re ≈ 2500
  },
  {
    title: "ดันให้เป็น Turbulent",
    body: "เพิ่ม V หรือ D ต่อไป (μ ต่ำแบบน้ำ) จน Re เกิน 4000 จะเห็นการหมุนวน (eddies/vortices) และความปั่นป่วนชัดเจน เพราะแรงเฉื่อย (inertia) มีอิทธิพลเหนือแรงหนืด",
    apply: { rho: 1000, v: 3.0, d: 0.05, mu: 0.001 }, // Re ≈ 150000
  },
  {
    title: "สรุปความหมายของ Re",
    body: "Reynolds number Re = ρVD/μ เปรียบเทียบแรงเฉื่อยกับแรงหนืด ถ้า Re สูง (แรงเฉื่อยมาก) การไหลจะปั่นป่วน ถ้า Re ต่ำ (แรงหนืดมาก) การไหลจะราบเรียบ",
  },
];

const challenges: Challenge[] = [
  {
    id: "laminar",
    title: "ทำให้การไหลเป็นแบบ Laminar (Re < 2300)",
    hint: "ลดความเร็ว V หรือเส้นผ่านศูนย์กลาง D ลง หรือเพิ่มความหนืด μ เพื่อให้ Re เล็กลง",
    isSolved: (r) => r.re < REYNOLDS_LAMINAR_MAX,
    success: "สำเร็จ! Re < 2300 การไหลราบเรียบแบบ Laminar",
  },
  {
    id: "turbulent",
    title: "ทำให้การไหลเป็นแบบ Turbulent (Re > 4000)",
    hint: "เพิ่มความเร็ว V หรือเส้นผ่านศูนย์กลาง D หรือลดความหนืด μ เพื่อให้ Re ใหญ่ขึ้น",
    isSolved: (r) => r.re > REYNOLDS_TURBULENT_MIN,
    success: "สำเร็จ! Re > 4000 เกิดการปั่นป่วนและหมุนวนแบบ Turbulent",
  },
  {
    id: "transitional",
    title: "ทำให้อยู่ในช่วง Transitional (2300 ≤ Re ≤ 4000)",
    hint: "ปรับ V/D/μ ทีละนิดให้ Re ลงพอดีในช่วงแคบ ๆ ระหว่าง 2300 ถึง 4000",
    isSolved: (r) => r.re >= REYNOLDS_LAMINAR_MAX && r.re <= REYNOLDS_TURBULENT_MIN,
    success: "เยี่ยม! Re อยู่ในช่วงเปลี่ยนผ่าน เส้นการไหลเริ่มสั่น",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้า Re > 4000 การไหลเป็นแบบใด?",
    choices: ["Laminar", "Transitional", "Turbulent", "หยุดนิ่ง"],
    answer: 2,
    explain: "ตามเกณฑ์ของท่อ Re > 4000 คือการไหลแบบ Turbulent (ปั่นป่วน) ส่วน Re < 2300 คือ Laminar และระหว่างนั้นคือ Transitional",
  },
  {
    question: "ถ้าเพิ่มความเร็ว V ของของไหล (โดยอย่างอื่นคงที่) ค่า Re จะเป็นอย่างไร?",
    choices: ["เพิ่มขึ้น", "ลดลง", "เท่าเดิม", "เป็นศูนย์"],
    answer: 0,
    explain: "Re = ρVD/μ ค่า V อยู่ในตัวเศษ ดังนั้นเมื่อ V เพิ่ม Re ก็เพิ่มตาม ทำให้การไหลมีแนวโน้มปั่นป่วนมากขึ้น",
  },
  {
    question: "Reynolds number เปรียบเทียบแรงสองชนิดใดกัน?",
    choices: [
      "แรงโน้มถ่วง กับ แรงดัน",
      "แรงเฉื่อย (inertia) กับ แรงหนืด (viscous)",
      "แรงตึงผิว กับ แรงลอยตัว",
      "แรงเสียดทาน กับ แรงปกติ",
    ],
    answer: 1,
    explain: "Re เป็นอัตราส่วนของแรงเฉื่อย (inertia) ต่อแรงหนืด (viscous) ถ้าแรงเฉื่อยมากกว่ามาก การไหลจะปั่นป่วนง่าย",
  },
];

export default function ReynoldsSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FlowParticle[]>(seedParticles(PARTICLE_COUNT));
  const eddiesRef = useRef<Eddy[]>(seedEddies(EDDY_COUNT));
  const phaseRef = useRef(0); // accumulates by dt to animate travelling waves

  // Live values from current params.
  const re = reynoldsNumber(params.rho, params.v, params.d, params.mu);
  const regime = flowRegime(re);
  const turb = turbulence(re);

  // Keep the latest physics values available to the per-frame draw closure
  // without restarting anything.
  const physicsRef = useRef({ re, regime, turb, v: params.v });
  physicsRef.current = { re, regime, turb, v: params.v };

  // Re-seed particles & eddies when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    eddiesRef.current = seedEddies(EDDY_COUNT);
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { v, turb: t, regime: reg } = physicsRef.current;
    const centerY = height / 2;
    const halfH = height * 0.34; // pipe half-height in px

    // Advance the travelling-wave phase by dt (respects pause: dt = 0).
    phaseRef.current += dt * (2.2 + 2.5 * t);
    const phase = phaseRef.current;

    // --- pipe body fill ---
    const top = centerY - halfH;
    const bot = centerY + halfH;
    ctx.beginPath();
    ctx.rect(0, top, width, halfH * 2);
    const grad = ctx.createLinearGradient(0, top, 0, bot);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.18)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.32)" : "rgba(207,250,254,0.50)");
    ctx.fillStyle = grad;
    ctx.fill();

    // --- pipe walls (straight, horizontal) ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    // Colour: cool cyan for calm flow, tinting toward rose as it turns chaotic.
    const chaos = clamp(t, 0, 1);
    const streamColor = (alpha: number) => {
      const r = Math.round(lerp(dark ? 103 : 8, 244, chaos));
      const g = Math.round(lerp(dark ? 232 : 145, 63, chaos));
      const b = Math.round(lerp(dark ? 249 : 178, 94, chaos));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const LANES = 7;
    const laneFraction = (i: number) => -0.78 + (i / (LANES - 1)) * 1.56;
    const STEPS = 60;

    // --- streamlines ---
    if (controls.toggles.streamlines) {
      for (let i = 0; i < LANES; i++) {
        const f = laneFraction(i);
        const lane = i * 1.3;
        const pts: Pt[] = [];
        for (let s = 0; s <= STEPS; s++) {
          const xf = s / STEPS;
          const disp = streamlineWave(xf, t, phase, lane);
          // Keep streamlines inside the pipe walls even when very chaotic.
          const frac = clamp(f + disp, -0.97, 0.97);
          pts.push({ x: xf * width, y: centerY + frac * halfH });
        }
        drawStreamline(ctx, pts, streamColor(dark ? 0.35 : 0.4), 1.3);
      }
    }

    // --- eddies (only meaningful in turbulent regime) ---
    const eddies = eddiesRef.current;
    if (reg === "turbulent") {
      for (const e of eddies) {
        e.angle += e.omega * dt;
      }
    }
    const eddyStrength = reg === "turbulent" ? clamp((t - 1) * 2 + 0.5, 0, 1) : 0;

    // --- particles ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const dxf = v * SPEED * dt;
      let nx = p.xf + dxf;
      if (nx > 1) {
        nx -= 1;
        p.f = (Math.random() * 2 - 1) * 0.85;
        p.seed = Math.random() * Math.PI * 2;
      }
      p.xf = nx;

      if (!controls.toggles.particles) continue;

      // Base position follows the same travelling wave as the streamlines.
      const wave = streamlineWave(p.xf, t, phase, p.f * 4 + 2);
      const jitter = t * 0.12 * Math.sin(phase * 3 + p.seed * 5);
      let yFrac = p.f + wave + jitter;
      let px = p.xf * width;
      let py = centerY + yFrac * halfH;

      // In turbulent flow, particles near an eddy centre get swirled around it.
      if (eddyStrength > 0) {
        for (const e of eddies) {
          const ex = e.cx * width;
          const ey = centerY + e.cy * halfH;
          const er = e.r * halfH;
          const ddx = px - ex;
          const ddy = py - ey;
          const dist = Math.hypot(ddx, ddy);
          if (dist < er && dist > 1e-3) {
            // Rotate this point around the eddy centre by a swirl angle that
            // falls off toward the rim, scaled by turbulence strength.
            const falloff = (1 - dist / er) * eddyStrength;
            const swirl = e.omega * dt * 6 * falloff;
            const cos = Math.cos(swirl);
            const sin = Math.sin(swirl);
            px = ex + ddx * cos - ddy * sin;
            py = ey + ddx * sin + ddy * cos;
          }
        }
      }

      // Keep particles inside the pipe.
      py = clamp(py, top + 2, bot - 2);

      // Colour shifts cyan (laminar) → violet (turbulent); faster flow streaks
      // longer; turbulent particles glow to make eddies pop.
      const tNorm = clamp(t * 0.5, 0, 1);
      const trail = clamp(v * width * 0.026, 0, width * 0.05);
      drawFlowParticle(ctx, px, py, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.4,
        trail,
        alpha: 0.9,
        glow: t > 1,
      });
    }

    // --- velocity vectors ---
    if (controls.toggles.vectors) {
      const samples = [0.14, 0.32, 0.5, 0.68, 0.86];
      const len = clamp(v * (width * 0.045), 14, width * 0.18);
      for (const xf of samples) {
        const x = xf * width;
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.4, 8);
      }
    }

    // --- regime label ---
    drawLabel(ctx, `${REGIME_LABEL[reg]} · Re ≈ ${formatNumber(re, 0)}`, width / 2, top - 14, {
      align: "center",
      color: dark ? "#f8fafc" : "#0f172a",
      bg:
        reg === "laminar"
          ? "rgba(16,185,129,0.85)"
          : reg === "transitional"
            ? "rgba(245,158,11,0.85)"
            : "rgba(244,63,94,0.85)",
      font: "bold 13px 'IBM Plex Sans Thai', sans-serif",
    });
  };

  const explanation =
    regime === "laminar"
      ? "ตอนนี้การไหลเป็นแบบ Laminar เส้นการไหลเรียบขนานกัน เพราะแรงหนืด (viscous) ยังควบคุมการเคลื่อนที่ของของไหลได้ดี · Reynolds number บอกว่าแรงเฉื่อยมากกว่าแรงหนืดแค่ไหน ถ้าแรงเฉื่อยมาก การไหลจะปั่นป่วนง่าย"
      : regime === "transitional"
        ? "ตอนนี้การไหลอยู่ในช่วง Transitional (เปลี่ยนผ่าน) เส้นการไหลเริ่มสั่นและโยก เพราะแรงเฉื่อย (inertia) กับแรงหนืด (viscous) เริ่มสูสีกัน · Reynolds number บอกว่าแรงเฉื่อยมากกว่าแรงหนืดแค่ไหน ถ้าแรงเฉื่อยมาก การไหลจะปั่นป่วนง่าย"
        : "ตอนนี้การไหลเป็นแบบ Turbulent เพราะแรงเฉื่อย (inertia) มีอิทธิพลมากกว่าแรงหนืด ทำให้เกิดการปั่นป่วนและการหมุนวน · Reynolds number บอกว่าแรงเฉื่อยมากกว่าแรงหนืดแค่ไหน ถ้าแรงเฉื่อยมาก การไหลจะปั่นป่วนง่าย";

  const availableToggles = ["particles", "streamlines", "vectors", "graph", "formula"] as const;

  // Regime meter: clamp Re onto [0, 10000] so the marker stays visible.
  const METER_MAX = 10000;
  const meterX = (val: number) => (mapClamped(val, 0, METER_MAX, 0, 100));
  const markerX = clamp(meterX(re), 1.5, 98.5);

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ re, v: params.v, d: params.d, rho: params.rho, mu: params.mu }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="เลขเรย์โนลด์ Re"
          value={re}
          decimals={0}
          big
          accentClass={
            regime === "laminar"
              ? "text-emerald-600 dark:text-emerald-300"
              : regime === "transitional"
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat
          label="ประเภทการไหล Regime"
          value={`${REGIME_LABEL[regime]} (${REGIME_TH[regime]})`}
        />
        <ResultStat label="ความเร็ว V" value={params.v} unit="m/s" />
        <ResultStat label="เส้นผ่านศูนย์กลาง D" value={params.d} unit="m" decimals={3} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: `${REGIME_LABEL[regime]} ${REGIME_TH[regime]}`, tone: REGIME_TONE[regime] }}
      />

      <GraphPanel title="ช่วงการไหล (Flow Regime)">
        <svg viewBox="0 0 320 64" className="w-full" role="img" aria-label="แถบช่วงการไหลตามค่า Re">
          {/* three regime zones across [0, 10000] */}
          <rect x={0} y={18} width={meterX(REYNOLDS_LAMINAR_MAX) * 3.2} height={20} rx={3} fill="#10b981" opacity={0.85} />
          <rect
            x={meterX(REYNOLDS_LAMINAR_MAX) * 3.2}
            y={18}
            width={(meterX(REYNOLDS_TURBULENT_MIN) - meterX(REYNOLDS_LAMINAR_MAX)) * 3.2}
            height={20}
            rx={0}
            fill="#f59e0b"
            opacity={0.85}
          />
          <rect
            x={meterX(REYNOLDS_TURBULENT_MIN) * 3.2}
            y={18}
            width={(100 - meterX(REYNOLDS_TURBULENT_MIN)) * 3.2}
            height={20}
            rx={3}
            fill="#f43f5e"
            opacity={0.85}
          />
          {/* zone labels */}
          <text x={meterX(1150) * 3.2} y={51} textAnchor="middle" className="fill-ink-faint" fontSize={8}>Laminar</text>
          <text x={meterX(3150) * 3.2} y={51} textAnchor="middle" className="fill-ink-faint" fontSize={8}>Trans.</text>
          <text x={meterX(7000) * 3.2} y={51} textAnchor="middle" className="fill-ink-faint" fontSize={8}>Turbulent</text>
          {/* threshold ticks */}
          <text x={meterX(REYNOLDS_LAMINAR_MAX) * 3.2} y={13} textAnchor="middle" className="fill-ink-faint" fontSize={8}>2300</text>
          <text x={meterX(REYNOLDS_TURBULENT_MIN) * 3.2} y={13} textAnchor="middle" className="fill-ink-faint" fontSize={8}>4000</text>
          {/* current-Re marker */}
          <g transform={`translate(${markerX * 3.2}, 0)`}>
            <line x1={0} y1={12} x2={0} y2={44} stroke="rgb(var(--ink))" strokeWidth={2} />
            <polygon points="-5,8 5,8 0,16" fill="rgb(var(--ink))" />
          </g>
        </svg>
        <p className="mt-1 text-center text-[11px] text-ink-faint">
          🟢 Laminar (&lt;2300) · 🟠 Transitional (2300–4000) · 🔴 Turbulent (&gt;4000)
        </p>
      </GraphPanel>

      {controls.toggles.formula && (
        <FormulaCard
          formula="Re = ρVD/μ"
          substituted={`Re = (${formatNumber(params.rho, 0)})(${formatNumber(params.v)})(${formatNumber(params.d, 3)}) / ${formatNumber(params.mu, 4)} ≈ ${formatNumber(re, 0)}`}
          variables={[
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "D", meaning: "เส้นผ่านศูนย์กลางท่อ Diameter", unit: "m" },
            { symbol: "μ", meaning: "ความหนืด Viscosity", unit: "Pa·s" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            เกณฑ์ท่อ: Re &lt; 2300 → Laminar · Re &gt; 4000 → Turbulent · ระหว่างนั้น → Transitional
          </p>
        </FormulaCard>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เลขเรย์โนลด์"
      titleEn="Reynolds Number — Laminar สู่ Turbulent"
      icon="🌀"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความหนาแน่น" symbol="ρ" value={params.rho} min={500} max={1400} step={10} unit="kg/m³" decimals={0} onChange={set("rho")} />
          <ControlSlider label="ความเร็ว" symbol="V" value={params.v} min={0.1} max={8} step={0.1} unit="m/s" onChange={set("v")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ" symbol="D" value={params.d} min={0.01} max={0.3} step={0.01} unit="m" decimals={3} onChange={set("d")} />
          <ControlSlider label="ความหนืด (dynamic)" symbol="μ" value={params.mu} min={0.0005} max={0.1} step={0.0005} unit="Pa·s" decimals={4} onChange={set("mu")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-reynolds">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อตรงแสดงการไหลเปลี่ยนจาก Laminar ราบเรียบ เป็น Turbulent ปั่นป่วนตามค่า Reynolds"
          />
        </SimStage>
      }
      results={<div id="explain-reynolds">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
