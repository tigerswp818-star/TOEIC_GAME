import { useRef, useState } from "react";
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
import { approach, clamp, formatNumber, mapClamped } from "@/lib/math";
import { pressureColor } from "@/lib/colors";
import { drawArrow, drawLabel, roundRect } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  mechanicalAdvantage,
  outputForce,
  strokeRatioLargeOverSmall,
  strokeRatioSmallOverLarge,
  systemPressure,
} from "./pascalModel";

const F1_COLOR = "#f43f5e"; // rose — input force pressing down
const F2_COLOR = "#06b6d4"; // cyan — output force lifting up
const MA_MAX = 200; // A2/A1 upper bound for the graph x-axis

interface Params {
  f1: number; // input force on the small piston (N)
  a1: number; // small-piston area (cm²)
  a2: number; // large-piston area (cm²)
}
const DEFAULTS: Params = { f1: 200, a1: 5, a2: 200 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่พื้นที่ลูกสูบเท่ากัน",
    body: "ตั้งให้ลูกสูบเล็กและใหญ่มีพื้นที่ใกล้เคียงกัน (A₂ ≈ A₁) สังเกตว่าแรงออก F₂ เกือบเท่ากับแรงกด F₁ — ยังไม่มีการทดแรง",
    apply: { f1: 200, a1: 10, a2: 20 },
  },
  {
    title: "เพิ่มพื้นที่ลูกสูบใหญ่ A₂",
    body: "ค่อย ๆ ขยายลูกสูบใหญ่ให้ใหญ่ขึ้น ความดันในระบบยังเท่าเดิมทุกจุด แต่แรงออก F₂ = P·A₂ เพิ่มขึ้นตามพื้นที่ทันที",
    apply: { f1: 200, a1: 5, a2: 100 },
  },
  {
    title: "ขยายต่อจนได้แรงทด A₂/A₁ มาก",
    body: "ขยาย A₂ ให้ใหญ่ขึ้นอีก แรงทด (MA = A₂/A₁) สูงขึ้น ลูกสูบใหญ่ยกของหนักได้สบาย แต่สังเกตว่ามันขยับขึ้นช้ากว่าระยะที่เรากดลงมาก",
    apply: { f1: 200, a1: 5, a2: 400 },
  },
  {
    title: "สรุปกฎของปาสคาล",
    body: "ความดันส่งผ่านของไหลเท่ากันทุกทิศ P = F₁/A₁ = F₂/A₂ ทำให้ F₂ = F₁·A₂/A₁ ได้แรงมากขึ้นตามอัตราส่วนพื้นที่ — แต่ต้องแลกด้วยระยะกดที่มากกว่า งานที่ทำเท่าเดิม (อนุรักษ์พลังงาน)",
  },
];

const challenges: Challenge[] = [
  {
    id: "lift10k",
    title: "ยกของหนัก 10,000 N ด้วยแรงกดเท่าเดิม (F₂ ≥ 10,000 N)",
    hint: "F₂ = F₁·A₂/A₁ เพิ่มพื้นที่ลูกสูบใหญ่ A₂ หรือ ลด A₁ เพื่อให้แรงออกถึงเป้าหมาย",
    isSolved: (r) => r.f2 >= 10000,
    success: "สำเร็จ! แรงออกจากลูกสูบใหญ่มากพอจะยกของหนัก 10,000 N ได้แล้ว",
  },
  {
    id: "ma50",
    title: "ทำให้แรงทาง (MA = A₂/A₁) ถึง 50 เท่า",
    hint: "แรงทด = A₂/A₁ ขยายลูกสูบใหญ่ให้มีพื้นที่มากกว่าลูกสูบเล็ก 50 เท่า เช่น A₁ = 5, A₂ = 250",
    isSolved: (r) => r.ma >= 50,
    success: "เยี่ยม! อัตราส่วนพื้นที่ทำให้ได้แรงทดถึง 50 เท่า",
  },
  {
    id: "noGain",
    title: "ปรับให้แทบไม่มีการทดแรง (F₂ ≤ 1.5·F₁ และ MA ≤ 1.5)",
    hint: "เมื่อพื้นที่สองลูกสูบใกล้เคียงกัน (A₂ ≈ A₁) แรงออกจะเกือบเท่าแรงกด ระบบไม่ได้ทดแรง",
    isSolved: (r) => r.ma <= 1.5 && r.f2 <= 1.5 * r.f1,
    success: "ถูกต้อง! พื้นที่เท่ากัน ความดันเท่ากัน แรงออกจึงเท่าแรงกด ไม่มีการทดแรง",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ทำไมลูกสูบใหญ่จึงออกแรง F₂ ได้มากกว่าแรงกด F₁ ที่ลูกสูบเล็ก?",
    choices: [
      "เพราะความดันเท่ากันทั้งระบบ แต่ลูกสูบใหญ่มีพื้นที่มากกว่า F₂ = P·A₂",
      "เพราะของไหลเพิ่มพลังงานให้เอง",
      "เพราะลูกสูบใหญ่หนักกว่า",
      "เพราะแรงโน้มถ่วงช่วยดัน",
    ],
    answer: 0,
    explain:
      "กฎของปาสคาล: ความดัน P = F₁/A₁ ส่งผ่านของไหลเท่ากันทุกจุด ที่ลูกสูบใหญ่ F₂ = P·A₂ = F₁·A₂/A₁ พื้นที่ยิ่งมาก แรงยิ่งมากตามอัตราส่วนพื้นที่",
  },
  {
    question: "สิ่งใดที่ 'เท่ากันทุกจุด' ในระบบของไหลปิดตามกฎของปาสคาล?",
    choices: ["ความดัน P", "แรง F", "พื้นที่ A", "ระยะกระดิก d"],
    answer: 0,
    explain:
      "ความดันที่กระทำต่อของไหลปิดที่อัดตัวไม่ได้ ส่งผ่านไปทุกทิศทางและทุกจุดเท่ากัน (P = F₁/A₁ = F₂/A₂) ส่วนแรงและระยะจะต่างกันตามพื้นที่ของแต่ละลูกสูบ",
  },
  {
    question: "เมื่อใช้แม่แรงไฮดรอลิกทดแรงได้มาก เราต้องแลกกับอะไร?",
    choices: [
      "ต้องกดลูกสูบเล็กเป็นระยะทางมากกว่าระยะที่ลูกสูบใหญ่ยกขึ้น (งานเท่าเดิม)",
      "ของไหลจะร้อนขึ้นจนระเบิด",
      "ความดันจะลดลงครึ่งหนึ่ง",
      "ไม่ต้องแลกกับอะไรเลย ได้แรงฟรี",
    ],
    answer: 0,
    explain:
      "พลังงานอนุรักษ์: งานเข้า = งานออก  F₁·d₁ = F₂·d₂ เมื่อได้แรง F₂ มากขึ้น ระยะ d₂ จะน้อยลงตามส่วน เราจึงต้องกดลูกสูบเล็กหลายครั้ง/เป็นระยะไกลกว่า ไม่มีแรงฟรี",
  },
];

export default function PascalSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, particles: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Eased small-piston push fraction (0 = rest, 1 = fully pressed).
  const pushRef = useRef(0);

  const p = systemPressure(params.f1, params.a1);
  const f2 = outputForce(params.f1, params.a1, params.a2);
  const ma = mechanicalAdvantage(params.a1, params.a2);
  const d2OverD1 = strokeRatioLargeOverSmall(params.a1, params.a2);
  const d1OverD2 = strokeRatioSmallOverLarge(params.a1, params.a2);

  const set = (key: keyof Params) => (v: number) =>
    setParams((pr) => ({ ...pr, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((pr) => ({ ...pr, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";

    // --- cyclic pumping stroke driven purely by time, eased by dt ---
    // Target push oscillates 0→1 on a slow sine; ease toward it so pausing
    // (dt = 0) freezes the pistons mid-stroke.
    const targetPush = 0.5 - 0.5 * Math.cos(time * 1.1);
    pushRef.current = approach(pushRef.current, targetPush, Math.min(1, dt * 6));
    const push = pushRef.current;

    // --- geometry: two cylinders joined by a U/H base of fluid ---
    const smallX = width * 0.26; // small-piston column centre
    const largeX = width * 0.7; // large-piston column centre
    const topY = height * 0.16; // top of the cylinders
    const baseTop = height * 0.74; // top of the shared horizontal connector
    const baseBot = height * 0.86; // bottom of the connector / floor of fluid
    const colSpan = baseTop - topY; // usable vertical travel inside a column

    // Cylinder widths scaled by piston area (visual, gently compressed range).
    const aMax = Math.max(params.a1, params.a2);
    const smallW = mapClamped(params.a1 / aMax, 0, 1, width * 0.07, width * 0.2);
    const largeW = mapClamped(params.a2 / aMax, 0, 1, width * 0.07, width * 0.28);
    const smallHalf = smallW / 2;
    const largeHalf = largeW / 2;

    // Stroke amplitudes: small piston pushes down by d1, large rises by
    // d2 = d1 · A1/A2 (volume conservation). Keep them inside the columns.
    const d1 = colSpan * 0.34 * push;
    const d2 = d1 * d2OverD1;

    // Rest levels of each piston face when push = 0.
    const smallRest = topY + colSpan * 0.16;
    const largeRest = topY + colSpan * 0.5;
    const smallFaceY = smallRest + d1; // moves DOWN
    const largeFaceY = largeRest - d2; // moves UP

    // --- shared fluid body (uniform equal-pressure colour) ---
    // Normalised pressure for the colour map (compressed so changes are visible).
    const pNorm = clamp(mapClamped(p, 0, 4_000_000, 0.15, 0.92), 0, 1);
    const fluidColor = pressureColor(pNorm, dark ? 0.8 : 0.9);

    ctx.save();
    ctx.beginPath();
    // small column interior (from its piston face down)
    ctx.rect(smallX - smallHalf, smallFaceY, smallW, baseBot - smallFaceY);
    // large column interior (from its piston face down)
    ctx.rect(largeX - largeHalf, largeFaceY, largeW, baseBot - largeFaceY);
    // horizontal connector joining the two columns at the base
    ctx.rect(smallX - smallHalf, baseTop, largeX - smallX + largeHalf + smallHalf, baseBot - baseTop);
    ctx.clip();
    ctx.fillStyle = fluidColor;
    ctx.fillRect(0, topY, width, baseBot - topY);
    ctx.restore();

    // --- cylinder + connector walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    // small cylinder (open top)
    ctx.beginPath();
    ctx.moveTo(smallX - smallHalf, topY);
    ctx.lineTo(smallX - smallHalf, baseBot);
    ctx.moveTo(smallX + smallHalf, topY);
    ctx.lineTo(smallX + smallHalf, baseBot);
    ctx.stroke();
    // large cylinder (open top)
    ctx.beginPath();
    ctx.moveTo(largeX - largeHalf, topY);
    ctx.lineTo(largeX - largeHalf, baseBot);
    ctx.moveTo(largeX + largeHalf, topY);
    ctx.lineTo(largeX + largeHalf, baseBot);
    ctx.stroke();
    // connector floor + bottoms
    ctx.beginPath();
    ctx.moveTo(smallX - smallHalf, baseBot);
    ctx.lineTo(largeX + largeHalf, baseBot);
    ctx.moveTo(smallX + smallHalf, baseBot);
    ctx.lineTo(smallX + smallHalf, baseTop);
    ctx.lineTo(largeX - largeHalf, baseTop);
    ctx.lineTo(largeX - largeHalf, baseBot);
    ctx.stroke();

    // --- pistons (rounded plates) ---
    const pistonH = 12;
    const pistonFill = dark ? "rgba(148,163,184,0.95)" : "rgba(100,116,139,0.95)";
    ctx.fillStyle = pistonFill;
    roundRect(ctx, smallX - smallHalf, smallFaceY - pistonH, smallW, pistonH, 4);
    ctx.fill();
    roundRect(ctx, largeX - largeHalf, largeFaceY - pistonH, largeW, pistonH, 4);
    ctx.fill();

    // --- piston rods ---
    ctx.lineWidth = 5;
    ctx.strokeStyle = dark ? "#64748b" : "#475569";
    ctx.beginPath();
    ctx.moveTo(smallX, smallFaceY - pistonH);
    ctx.lineTo(smallX, topY - 18);
    ctx.stroke();

    // --- heavy load resting on the large piston ---
    const loadW = largeW * 0.82;
    const loadH = Math.min(46, colSpan * 0.28);
    const loadY = largeFaceY - pistonH - loadH;
    ctx.fillStyle = dark ? "rgba(217,119,6,0.92)" : "rgba(180,83,9,0.92)";
    roundRect(ctx, largeX - loadW / 2, loadY, loadW, loadH, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(15,23,42,0.5)" : "rgba(15,23,42,0.4)";
    ctx.stroke();
    drawLabel(ctx, "โหลด Load", largeX, loadY + loadH / 2, {
      align: "center",
      color: "#ffffff",
      bg: "rgba(120,53,15,0.85)",
    });

    // --- equal-pressure annotation in the connector ---
    drawLabel(ctx, "ความดันเท่ากันทั้งระบบ P", (smallX + largeX) / 2, (baseTop + baseBot) / 2, {
      align: "center",
      color: "#ffffff",
      bg: "rgba(15,23,42,0.7)",
    });

    // --- column labels ---
    drawLabel(ctx, "ลูกสูบเล็ก A₁", smallX, topY - 30, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "ลูกสูบใหญ่ A₂", largeX, topY - 30, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- force arrows: F1 down on small piston, F2 up on large piston ---
    if (controls.toggles.vectors) {
      const maxF = Math.max(params.f1, f2, 1e-6);
      const maxLen = colSpan * 0.42;
      // Length ∝ force (shared scale so the gain reads visually).
      const f1Len = Math.max(14, (params.f1 / maxF) * maxLen);
      const f2Len = Math.max(14, (f2 / maxF) * maxLen);
      // F1 presses DOWN onto the small piston (arrow ends at the piston face).
      drawArrow(ctx, smallX, smallFaceY - pistonH - f1Len, smallX, smallFaceY - pistonH, F1_COLOR, 3.5, 11);
      drawLabel(ctx, `F₁ = ${formatNumber(params.f1, 0)} N`, smallX, smallFaceY - pistonH - f1Len - 12, {
        align: "center",
        color: "#ffffff",
        bg: F1_COLOR,
      });
      // F2 lifts UP from the large piston (arrow points up, out of the load).
      drawArrow(ctx, largeX, loadY, largeX, loadY - f2Len, F2_COLOR, 3.5, 11);
      drawLabel(ctx, `F₂ = ${formatNumber(f2, 0)} N`, largeX, loadY - f2Len - 12, {
        align: "center",
        color: "#ffffff",
        bg: F2_COLOR,
      });
    }

    // --- system pressure readout (toggle: pressure) ---
    if (controls.toggles.pressure) {
      drawLabel(ctx, `P = ${formatNumber(p, 0)} Pa`, smallX, baseBot + 18, {
        align: "center",
        color: "#ffffff",
        bg: pressureColor(pNorm, 1),
      });
    }
  };

  const f2Display = f2 >= 1000 ? f2 / 1000 : f2;
  const f2Unit = f2 >= 1000 ? "kN" : "N";
  const pDisplay = p >= 1000 ? p / 1000 : p;
  const pUnit = p >= 1000 ? "kPa" : "Pa";

  const explanation = `กฎของปาสคาล: ความดันส่งผ่านของไหลเท่ากันทุกทิศ P = F₁/A₁ = ${formatNumber(
    p,
    0,
  )} Pa ทำให้ลูกสูบใหญ่ออกแรง F₂ = F₁·A₂/A₁ = ${formatNumber(
    f2,
    0,
  )} N มากกว่าแรงกด ${formatNumber(ma, 1)} เท่า ตามอัตราส่วนพื้นที่ — แต่ต้องแลกด้วยระยะกดที่มากกว่า (ลูกสูบใหญ่ขยับขึ้นเพียง ${formatNumber(
    d2OverD1,
    3,
  )} เท่าของระยะที่กดลง งานเท่าเดิม)`;

  // F2 vs (A2/A1) ratio line, with the current operating point marked.
  const curve = Array.from({ length: 41 }, (_, i) => {
    const r = (i / 40) * MA_MAX;
    return { x: r, y: params.f1 * r };
  });

  const availableToggles = ["vectors", "pressure", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ f1: params.f1, f2, ma, p, a1: params.a1, a2: params.a2 }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงออกลูกสูบใหญ่ F₂"
          value={f2Display}
          unit={f2Unit}
          big
          decimals={f2 >= 1000 ? 2 : 0}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat
          label="ความดันในระบบ P"
          value={pDisplay}
          unit={pUnit}
          decimals={p >= 1000 ? 1 : 0}
        />
        <ResultStat label="แรงทด A₂/A₁" value={ma} unit="×" decimals={1} />
        <ResultStat label="อัตราระยะกด d₁/d₂" value={d1OverD2} unit="×" decimals={1} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: "P = F/A เท่ากันทั้งระบบ", tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="P = F₁/A₁ = F₂/A₂   →   F₂ = F₁·A₂/A₁"
          substituted={`F₂ = (${formatNumber(params.f1, 0)})·(${formatNumber(
            params.a2,
            0,
          )}/${formatNumber(params.a1, 1)}) = ${formatNumber(f2, 0)} N   ·   P = ${formatNumber(p, 0)} Pa`}
          variables={[
            { symbol: "F₁", meaning: "แรงกดลูกสูบเล็ก Input force", unit: "N" },
            { symbol: "F₂", meaning: "แรงออกลูกสูบใหญ่ Output force", unit: "N" },
            { symbol: "A₁", meaning: "พื้นที่ลูกสูบเล็ก Small-piston area", unit: "m²" },
            { symbol: "A₂", meaning: "พื้นที่ลูกสูบใหญ่ Large-piston area", unit: "m²" },
            { symbol: "P", meaning: "ความดันในระบบ Pressure", unit: "Pa" },
            { symbol: "MA", meaning: "แรงทด Mechanical advantage = A₂/A₁", unit: "×" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงออก F₂ เทียบกับอัตราส่วนพื้นที่ A₂/A₁ (F₂ = F₁·A₂/A₁)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="อัตราส่วนพื้นที่ A₂/A₁ (เท่า)"
            yLabel="แรงออก F₂ (N)"
            markers={[{ x: ma, y: f2, color: "#ef4444", label: "ค่าปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 ค่าปัจจุบัน (A₂/A₁, F₂) — เส้นตรงผ่านจุดกำเนิด อัตราส่วนพื้นที่ยิ่งมาก แรงออกยิ่งสูงเป็นสัดส่วน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แม่แรงไฮดรอลิก (กฎปาสคาล)"
      titleEn="Pascal's Hydraulic Press"
      icon="🛠️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="แรงกดลูกสูบเล็ก"
            symbol="F₁"
            value={params.f1}
            min={10}
            max={2000}
            step={10}
            unit="N"
            decimals={0}
            onChange={set("f1")}
          />
          <ControlSlider
            label="พื้นที่ลูกสูบเล็ก"
            symbol="A₁"
            value={params.a1}
            min={1}
            max={50}
            step={0.5}
            unit="cm²"
            decimals={1}
            onChange={set("a1")}
          />
          <ControlSlider
            label="พื้นที่ลูกสูบใหญ่"
            symbol="A₂"
            value={params.a2}
            min={10}
            max={1000}
            step={5}
            unit="cm²"
            decimals={0}
            onChange={set("a2")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-pascal">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="แม่แรงไฮดรอลิกสองลูกสูบเชื่อมด้วยของไหล ลูกสูบเล็กกดลงดันลูกสูบใหญ่ให้ยกของหนักขึ้น พร้อมลูกศรแรง F₁ และ F₂"
          />
        </SimStage>
      }
      results={<div id="explain-pascal">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
