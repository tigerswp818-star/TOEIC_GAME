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
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  turbulentProfile,
  laminarProfile,
  powerIndex,
  meanOverMaxTurbulent,
  LAMINAR_MEAN_OVER_MAX,
  seedParticles,
  type ProfileParticle,
} from "./turbulentProfileModel";

const PARTICLE_COUNT = 220;
const SPEED = 0.07; // normalised xf per second per (m/s)

interface Params {
  umax: number;
  R: number;
  Re: number;
}
const DEFAULTS: Params = { umax: 3, R: 0.1, Re: 1e5 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ turbulent พื้นฐาน",
    body: "ตั้ง Re ≈ 4000 (เพิ่งเป็น turbulent) สังเกตหน้าตัดความเร็ว: อนุภาคในแกนกลางท่อวิ่งด้วยความเร็วใกล้เคียงกันเป็นบริเวณกว้าง มีเพียงชั้นบาง ๆ ใกล้ผนังที่ความเร็วลดลงอย่างชัน",
    apply: { umax: 3, R: 0.1, Re: 4000 },
  },
  {
    title: "เพิ่ม Re → หน้าตัด 'แบนกว่า'",
    body: "ค่อย ๆ เพิ่ม Re ขึ้นไป ดัชนี n เพิ่มขึ้น ทำให้หน้าตัดความเร็วเต็มและแบนยิ่งขึ้น (ความเร็วเฉลี่ย / u_max ขยับเข้าใกล้ 0.8) ความชันความเร็วถูกบีบไปอยู่ใกล้ผนังมากขึ้น",
    apply: { umax: 3, R: 0.1, Re: 5e5 },
  },
  {
    title: "เปรียบเทียบกับ Laminar",
    body: "เปิดสวิตช์ 'เทียบ Laminar' จะเห็นพาราโบลา laminar (เส้นประ) ที่ u_max เท่ากัน หน้าตัด laminar แหลม-โค้งกว่า ความเร็วเฉลี่ยเป็นเพียงครึ่งหนึ่งของ u_max (0.5) ขณะที่ turbulent เต็มกว่ามาก",
    apply: { umax: 3, R: 0.1, Re: 1e5 },
  },
  {
    title: "สรุปหลักการ",
    body: "การไหล turbulent ผสมโมเมนตัมข้ามชั้น (momentum mixing) ทำให้พลังงานกระจายทั่วหน้าตัด ความเร็วจึงเกือบเท่ากันทั้งแกนกลาง ต่างจาก laminar ที่ความเร็วไล่จากสูงสุดตรงกลางลงเป็นพาราโบลา",
  },
];

const challenges: Challenge[] = [
  {
    id: "ratio80",
    title: "ทำให้ความเร็วเฉลี่ย / u_max ≥ 0.80",
    hint: "อัตราส่วนนี้เพิ่มตามดัชนี n ซึ่งโตตาม Re — ลองเพิ่ม Re ให้สูงขึ้น",
    isSolved: (r) => r.ratio >= 0.8 - 1e-6,
    success: "สำเร็จ! หน้าตัดเต็มจน mean/u_max ถึง 0.8 ตามแบบ turbulent ทั่วไป",
  },
  {
    id: "index9",
    title: "ทำให้ดัชนีกำลัง n ≥ 9 (หน้าตัดแบนมาก)",
    hint: "n โตช้า ๆ ตาม Re ต้องดัน Re ขึ้นไปสูงมาก (เข้าใกล้ 1e6)",
    isSolved: (r) => r.n >= 9 - 1e-6,
    success: "เยี่ยม! n ≥ 9 หน้าตัดความเร็วแบนเกือบเต็มหน้าตัดท่อ",
  },
  {
    id: "fullness",
    title: "แสดงการแบนขึ้น: ทำให้ mean/u_max ≥ 0.82 พร้อม n ≥ 8",
    hint: "ทั้งสองค่าโตไปด้วยกันเมื่อ Re สูงขึ้น ดัน Re ให้สูงพอ",
    isSolved: (r) => r.ratio >= 0.82 - 1e-6 && r.n >= 8 - 1e-6,
    success: "ใช่เลย! Re สูงทำให้ทั้ง n และ mean/u_max เพิ่ม หน้าตัดยิ่งแบน",
  },
];

const quiz: QuizItem[] = [
  {
    question: "หน้าตัดความเร็ว (velocity profile) แบบใด 'แบนกว่า' กัน?",
    choices: ["Laminar", "Turbulent", "แบนเท่ากัน", "ขึ้นกับสีของท่อ"],
    answer: 1,
    explain: "Turbulent มีหน้าตัดแบน (full) กว่ามาก เพราะการผสมโมเมนตัมข้ามชั้นทำให้ความเร็วเกือบเท่ากันทั้งแกนกลาง ส่วน laminar เป็นพาราโบลาแหลม",
  },
  {
    question: "ทำไมการไหล turbulent ถึงทำให้ความเร็วเกือบเท่ากันทั่วแกนกลางท่อ?",
    choices: [
      "เพราะของไหลหยุดนิ่ง",
      "เพราะการผสมโมเมนตัม (momentum mixing) ข้ามชั้นกระจายความเร็ว",
      "เพราะแรงโน้มถ่วงดึงลง",
      "เพราะท่อแคบลง",
    ],
    answer: 1,
    explain: "การปั่นป่วนพาโมเมนตัมจากแกนกลางไปยังชั้นใกล้ผนังและกลับมา ทำให้ความเร็วเฉลี่ยทั่วหน้าตัดใกล้เคียงกัน เหลือความชันชัด ๆ เฉพาะใกล้ผนัง",
  },
  {
    question: "อัตราส่วนความเร็วเฉลี่ย / u_max ของ turbulent โดยทั่วไปประมาณเท่าใด (เทียบ laminar = 0.5)?",
    choices: ["0.25", "0.5", "≈0.8", "1.0"],
    answer: 2,
    explain: "สำหรับ 1/7th power law อัตราส่วน mean/u_max ≈ 0.8 ซึ่งสูงกว่าของ laminar (0.5) สะท้อนว่าหน้าตัดเต็ม/แบนกว่า",
  },
];

export default function TurbulentProfileSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [compare, setCompare] = useState(true);

  const particlesRef = useRef<ProfileParticle[]>(seedParticles(PARTICLE_COUNT));
  const phaseRef = useRef(0); // accumulates by dt to animate turbulent jitter

  // Derived physics from current params.
  const n = powerIndex(params.Re);
  const ratio = meanOverMaxTurbulent(n);

  // Keep latest values available to the per-frame draw closure.
  const physicsRef = useRef({ umax: params.umax, n, compare });
  physicsRef.current = { umax: params.umax, n, compare };

  // Re-seed particles & reset phase when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { umax, n: nn, compare: cmp } = physicsRef.current;
    const centerY = height / 2;
    const halfH = height * 0.36; // pipe half-height (= radius R) in px

    // Advance turbulent jitter phase by dt (respects pause: dt = 0).
    phaseRef.current += dt * 6;
    const phase = phaseRef.current;

    const top = centerY - halfH;
    const bot = centerY + halfH;

    // --- pipe body fill ---
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

    // Local velocity helpers (use rf as r/R, both profiles share u_max = 1 base).
    const turbVel = (rf: number) => turbulentProfile(Math.abs(rf), 1, umax, nn);
    const lamVel = (rf: number) => laminarProfile(Math.abs(rf), 1, umax);
    const maxVel = Math.max(umax, 1e-6);

    // --- particles in radial layers, speed = u(r) ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const vel = turbVel(p.rf);
      const dxf = vel * SPEED * dt;
      let nx = p.xf + dxf;
      if (nx > 1) {
        nx -= 1;
        p.rf = Math.random() * 2 - 1;
        p.seed = Math.random() * Math.PI * 2;
      }
      p.xf = nx;

      if (!controls.toggles.particles) continue;

      // Slight turbulent jitter on the vertical position (scaled small, and
      // suppressed right at the wall so the no-slip layer stays crisp).
      const jitter = 0.05 * (1 - Math.abs(p.rf)) * Math.sin(phase * 1.7 + p.seed * 5);
      const rfShown = clamp(p.rf + jitter, -0.985, 0.985);
      const x = p.xf * width;
      const y = centerY + rfShown * halfH;
      const tNorm = clamp(vel / maxVel, 0, 1);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }

    // --- velocity-profile curve (turbulent, solid) anchored near pipe exit ---
    const baseX = width * 0.62; // x where u = 0
    const scaleX = width * 0.3; // px per (u/u_max)
    const samples = 64;
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const rf = -1 + (i / samples) * 2;
      const u = turbVel(rf) / maxVel;
      const x = baseX + u * scaleX;
      const y = centerY + rf * halfH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // baseline (u = 0) for the profile sketch
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.35)" : "rgba(71,85,105,0.4)";
    ctx.beginPath();
    ctx.moveTo(baseX, top);
    ctx.lineTo(baseX, bot);
    ctx.stroke();
    ctx.restore();

    // --- laminar reference parabola (dashed) when compare is on ---
    if (cmp) {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "#fbbf24" : "#d97706";
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const rf = -1 + (i / samples) * 2;
        const u = lamVel(rf) / maxVel;
        const x = baseX + u * scaleX;
        const y = centerY + rf * halfH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, "Laminar (พาราโบลา)", baseX + scaleX * 0.5, top - 14, {
        align: "center",
        color: dark ? "#fbbf24" : "#b45309",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    drawLabel(ctx, "Turbulent (แบน/เต็ม)", baseX + scaleX, centerY, {
      align: "left",
      color: dark ? "#67e8f9" : "#0e7490",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- velocity vectors sampled across the radius ---
    if (controls.toggles.vectors) {
      const fracs = [-0.85, -0.5, -0.2, 0, 0.2, 0.5, 0.85];
      const vecX = width * 0.14;
      for (const rf of fracs) {
        const u = turbVel(rf) / maxVel;
        const len = clamp(u * width * 0.16, 4, width * 0.18);
        const y = centerY + rf * halfH;
        drawArrow(ctx, vecX, y, vecX + len, y, "#f59e0b", 2.2, 7);
      }
    }
  };

  const explanation =
    `การไหล turbulent ผสมโมเมนตัมข้ามชั้น ทำให้หน้าตัดความเร็ว 'แบนกว่า' laminar — ความเร็วเฉลี่ยใกล้ u_max (≈${formatNumber(ratio)}) ` +
    `ขณะที่ laminar เพียง ${formatNumber(LAMINAR_MEAN_OVER_MAX)} ความชันความเร็วอยู่ใกล้ผนังเป็นหลัก (ดัชนีกำลัง n ≈ ${formatNumber(n, 1)} ที่ Re ≈ ${formatNumber(params.Re, 0)})`;

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  // u-vs-r curves for the graph (r/R on x, u/u_max on y) — turbulent vs laminar.
  const samples = 41;
  const turbCurve = Array.from({ length: samples }, (_, i) => {
    const rf = i / (samples - 1); // 0 (centre) → 1 (wall)
    return { x: rf, y: turbulentProfile(rf, 1, params.umax, n) };
  });
  const lamCurve = Array.from({ length: samples }, (_, i) => {
    const rf = i / (samples - 1);
    return { x: rf, y: laminarProfile(rf, 1, params.umax) };
  });

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ ratio, n, umax: params.umax, R: params.R, Re: params.Re }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็วเฉลี่ย / u_max"
          value={ratio}
          unit="เท่า"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ดัชนีกำลัง n" value={n} unit="" decimals={1} />
        <ResultStat label="ความเร็วกลางท่อ u_max" value={params.umax} unit="m/s" decimals={1} />
        <ResultStat label="รัศมีท่อ R" value={params.R} unit="m" decimals={2} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: "หน้าตัดแบนกว่า laminar", tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="u(r) = u_max·(1 − r/R)^(1/n)"
          substituted={`เทียบ Laminar: u(r) = u_max·(1 − (r/R)²) · ที่ n = ${formatNumber(n, 1)} → mean/u_max ≈ ${formatNumber(ratio)} (laminar = ${formatNumber(LAMINAR_MEAN_OVER_MAX)})`}
          variables={[
            { symbol: "u(r)", meaning: "ความเร็วที่รัศมี r Velocity", unit: "m/s" },
            { symbol: "u_max", meaning: "ความเร็วสูงสุดกลางท่อ", unit: "m/s" },
            { symbol: "r", meaning: "ระยะจากแกนท่อ Radius", unit: "m" },
            { symbol: "R", meaning: "รัศมีท่อ Pipe radius", unit: "m" },
            { symbol: "n", meaning: "ดัชนีกำลัง (โตตาม Re)", unit: "—" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            Turbulent: หน้าตัด 'เต็ม/แบน' (1/7th power law, n≈7) · Laminar: พาราโบลาแหลม mean/u_max = 0.5
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความเร็ว u เทียบกับรัศมี r (Turbulent vs Laminar)">
          <LineChart
            series={[
              { points: turbCurve, color: "#06b6d4", label: "Turbulent" },
              { points: lamCurve, color: "#f59e0b", label: "Laminar", dashed: true },
            ]}
            xLabel="ระยะจากแกน r/R (0 = กลางท่อ, 1 = ผนัง)"
            yLabel="ความเร็ว u (m/s)"
            domain={{ xMin: 0, xMax: 1, yMin: 0, yMax: params.umax }}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟦 Turbulent (เส้นทึบ) แบน/เต็ม · 🟧 Laminar (เส้นประ) พาราโบลา — ยิ่ง Re สูง turbulent ยิ่งแบน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="หน้าตัดความเร็ว Turbulent"
      titleEn="Turbulent Velocity Profile"
      icon="🌫️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วกลางท่อ" symbol="u_max" value={params.umax} min={0.5} max={10} step={0.1} unit="m/s" decimals={1} onChange={set("umax")} />
          <ControlSlider label="รัศมีท่อ" symbol="R" value={params.R} min={0.02} max={0.3} step={0.01} unit="m" decimals={2} onChange={set("R")} />
          <ControlSlider label="เลขเรย์โนลด์" symbol="Re" value={params.Re} min={4000} max={1e6} step={1000} unit="" decimals={0} onChange={set("Re")} />
          <div className="border-t border-line pt-3">
            <ToggleChip
              label="เทียบ Laminar (พาราโบลา)"
              icon="📐"
              active={compare}
              onClick={() => setCompare((c) => !c)}
            />
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-turbulent">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อแสดงหน้าตัดความเร็ว turbulent ที่แบนกว่า laminar พร้อมอนุภาคไหลในชั้นรัศมี"
          />
        </SimStage>
      }
      results={<div id="explain-turbulent">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
