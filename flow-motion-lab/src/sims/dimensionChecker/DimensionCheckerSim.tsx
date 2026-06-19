import { useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { approach, clamp } from "@/lib/math";
import { roundRect, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  EQUATIONS,
  BASE_DIMENSIONS,
  QUANTITIES,
  dimensionsOf,
  isHomogeneous,
  formatDim,
  formatDimFull,
  buildResult,
  type Dim,
} from "./dimensionCheckerModel";

/** Maximum beam tilt (radians) when fully unbalanced. */
const MAX_TILT = 0.26;
/** Easing rate per second for the tilt animation. */
const TILT_RATE = 6;

/**
 * Guided steps cycle the equation via a numeric sentinel `eq` (the equation
 * index). GuidedSteps applies `Record<string, number>`, read back below.
 */
const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากสมการที่ถูกต้อง P = ρgh",
    body: "เลือกสมการความดันอุทกสถิต P = ρgh มิติทั้งสองข้างเป็น [M L⁻¹ T⁻²] เท่ากัน คานสมดุลจึงอยู่ในแนวระดับ (เขียว) = สมมูล",
    apply: { eq: 0 },
  },
  {
    title: "ลองสมการที่ผิด P = ρg",
    body: "สลับไปสมการ P = ρg ที่ขาดความสูง h ฝั่งขวากลายเป็น [M L⁻² T⁻²] ไม่ตรงกับ P ที่เป็น [M L⁻¹ T⁻²] คานจึงเอียง (แดง) = ไม่สมมูล",
    apply: { eq: 1 },
  },
  {
    title: "สมการที่ซับซ้อนขึ้น F = ρV²A",
    body: "เลือก F = ρV²A ฝั่งขวาคูณกันแล้วบวกเลขชี้กำลัง: ρ[1,−3,0] + V²[0,2,−2] + A[0,2,0] = [1,1,−2] เท่ากับแรง F พอดี คานสมดุล",
    apply: { eq: 3 },
  },
  {
    title: "เทียบสมการผิดอีกครั้ง P = ρV",
    body: "ปิดท้ายด้วย P = ρV ฝั่งขวาเป็น [M L⁻² T⁻¹] ไม่ตรงกับ P เลย คานเอียงแรง สรุปหลักการ: สมการที่ถูกต้องต้องมีมิติทั้งสองข้างเท่ากัน (dimensional homogeneity)",
    apply: { eq: 5 },
  },
];

const challenges: Challenge[] = [
  {
    id: "find-balanced",
    title: "หาสมการที่มิติสมดุล (คานอยู่ในแนวระดับ เขียว)",
    hint: "ลองสมการพื้นฐานอย่าง Q = AV หรือ P = ρgh ที่มิติทั้งสองข้างเท่ากัน",
    isSolved: (r) => r.balanced === 1,
    success: "ถูกต้อง! สมการนี้มีมิติทั้งสองข้างเท่ากัน เป็นสมการที่สมมูลทางมิติ (homogeneous)",
  },
  {
    id: "find-unbalanced",
    title: "หาสมการที่มิติไม่สมดุล (คานเอียง แดง)",
    hint: "มองหาสมการที่ 'ขาด' บางพจน์ไป เช่น P = ρg (ขาด h) หรือ P = ρV",
    isSolved: (r) => r.balanced === 0,
    success: "เยี่ยม! สมการนี้มิติสองข้างไม่ตรงกัน จึงเป็นไปไม่ได้ทางฟิสิกส์ — ผิดแน่นอน",
  },
  {
    id: "torricelli",
    title: "หาสมการที่มีรากที่สองและยังสมดุลอยู่",
    hint: "สมการความเร็วทอร์ริเชลลี V = √(2gh) ใช้เลขชี้กำลัง ½ กับ g และ h",
    isSolved: (r) => r.balanced === 1 && EQUATIONS[r.eqIndex]?.id === "V=sqrt_2gh",
    success: "สำเร็จ! √(2gh) ให้มิติ ½([0,1,−2]+[0,1,0]) = [0,1,−1] = ความเร็ว V พอดี",
  },
];

const quiz: QuizItem[] = [
  {
    question: "หลักการ 'ความสมมูลทางมิติ (dimensional homogeneity)' หมายความว่าอย่างไร?",
    choices: [
      "ทั้งสองข้างของสมการต้องมีมิติ [M, L, T] เท่ากัน",
      "ทั้งสองข้างต้องมีตัวเลขเท่ากัน",
      "สมการต้องมีหน่วยเป็น SI เท่านั้น",
      "ทุกพจน์ต้องเป็นบวก",
    ],
    answer: 0,
    explain:
      "สมการทางฟิสิกส์ที่ถูกต้องต้องมีมิติของทั้งสองข้างเท่ากัน ถ้ามิติไม่ตรงกันแสดงว่าสมการผิดแน่นอน นี่คือเครื่องมือตรวจสอบเบื้องต้นที่ทรงพลังมาก",
  },
  {
    question: "สมการความดันอุทกสถิต P = ρgh ถูกต้องทางมิติหรือไม่?",
    choices: [
      "ถูก เพราะทั้งสองข้างเป็น [M L⁻¹ T⁻²]",
      "ผิด เพราะฝั่งขวาไม่มีมิติ",
      "ผิด เพราะ ρ ไม่มีมิติ",
      "บอกไม่ได้ถ้าไม่รู้ค่าตัวเลข",
    ],
    answer: 0,
    explain:
      "ρ[1,−3,0] + g[0,1,−2] + h[0,1,0] = [1,−1,−2] เท่ากับความดัน P[1,−1,−2] พอดี จึงสมมูลทางมิติและเป็นสมการที่ถูกต้อง",
  },
  {
    question: "มิติฐาน (base dimensions) ที่ใช้ในการตรวจสอบนี้คือข้อใด?",
    choices: [
      "มวล M, ความยาว L, เวลา T",
      "ความดัน, ความเร็ว, แรง",
      "เมตร, กิโลกรัม, วินาที",
      "พลังงาน, กำลัง, โมเมนตัม",
    ],
    answer: 0,
    explain:
      "มิติฐานในกลศาสตร์ของไหลคือ มวล [M] ความยาว [L] และเวลา [T] ทุกปริมาณเขียนเป็นผลคูณของกำลังของสามมิตินี้ได้ เช่น แรง = [M L T⁻²]",
  },
];

export default function DimensionCheckerSim() {
  const { theme } = useTheme();
  const controls = useSimControls({
    streamlines: false,
    particles: false,
    vectors: false,
    pressure: false,
  });
  const [mode, setMode] = useState<LearningMode>("explore");
  const [eqIndex, setEqIndex] = useState(0);

  const equation = EQUATIONS[eqIndex];
  const lhsDim = dimensionsOf(equation.lhs);
  const rhsDim = dimensionsOf(equation.rhs);
  const balanced = isHomogeneous(equation);
  const result = buildResult(eqIndex);

  // Animated beam tilt; eased toward target each frame via dt.
  const tiltRef = useRef(0);
  // Keep latest physics for the per-frame draw closure without restarting RAF.
  const sceneRef = useRef<{ lhs: Dim; rhs: Dim; balanced: boolean }>({
    lhs: lhsDim,
    rhs: rhsDim,
    balanced,
  });
  sceneRef.current = { lhs: lhsDim, rhs: rhsDim, balanced };

  // Guided steps push a numeric sentinel `eq`.
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.eq === "number") {
      setEqIndex(clamp(Math.round(vals.eq), 0, EQUATIONS.length - 1));
    }
  };

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { lhs, rhs, balanced: bal } = sceneRef.current;

    // Tilt target: 0 when balanced (level), otherwise lean toward the side with
    // the smaller total exponent magnitude (the "lighter" pan rises).
    const lhsWeight = Math.abs(lhs[0]) + Math.abs(lhs[1]) + Math.abs(lhs[2]);
    const rhsWeight = Math.abs(rhs[0]) + Math.abs(rhs[1]) + Math.abs(rhs[2]);
    const dir = rhsWeight >= lhsWeight ? 1 : -1; // +1 → right pan dips down
    const targetTilt = bal ? 0 : dir * MAX_TILT;
    // Ease toward the target; rate scaled by dt so it freezes on pause (dt = 0).
    tiltRef.current = approach(tiltRef.current, targetTilt, clamp(TILT_RATE * dt, 0, 1));
    const tilt = tiltRef.current;

    const cx = width / 2;
    const pivotY = height * 0.34;
    const beamHalf = width * 0.34;
    const okColor = dark ? "#34d399" : "#059669";
    const badColor = dark ? "#fb7185" : "#e11d48";
    const accent = bal ? okColor : badColor;
    const ink = dark ? "#e2e8f0" : "#0f172a";

    // --- stand / pivot column ---
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY);
    ctx.lineTo(cx, height * 0.82);
    ctx.stroke();
    // base
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.14, height * 0.82);
    ctx.lineTo(cx + width * 0.14, height * 0.82);
    ctx.stroke();
    // pivot fulcrum (triangle)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY - 10);
    ctx.lineTo(cx - 11, pivotY + 6);
    ctx.lineTo(cx + 11, pivotY + 6);
    ctx.closePath();
    ctx.fill();

    // --- the tilting beam (rotate about the pivot) ---
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const lx = cx - beamHalf * cos;
    const ly = pivotY - beamHalf * sin;
    const rx = cx + beamHalf * cos;
    const ry = pivotY + beamHalf * sin;

    ctx.strokeStyle = accent;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(rx, ry);
    ctx.stroke();

    // --- pans hung from each beam end ---
    const panDrop = height * 0.16;
    const panW = width * 0.3;
    const panH = height * 0.3;

    const drawPan = (
      anchorX: number,
      anchorY: number,
      title: string,
      dimStr: string,
      dim: Dim,
    ) => {
      const px = anchorX;
      const py = anchorY + panDrop;
      // hanger cord
      ctx.strokeStyle = dark ? "#475569" : "#64748b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(px, py);
      ctx.stroke();
      // pan card
      ctx.save();
      ctx.fillStyle = bal
        ? dark ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.14)"
        : dark ? "rgba(244,63,94,0.18)" : "rgba(244,63,94,0.12)";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      roundRect(ctx, px - panW / 2, py, panW, panH, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // title
      ctx.fillStyle = ink;
      ctx.font = "bold 12px 'IBM Plex Sans Thai', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, px, py + 16);
      // dimension string [M^a L^b T^c]
      ctx.fillStyle = accent;
      ctx.font = "bold 15px 'IBM Plex Sans Thai', sans-serif";
      ctx.fillText(dimStr, px, py + panH * 0.42);
      // exponent vector [a, b, c]
      ctx.fillStyle = dark ? "#94a3b8" : "#475569";
      ctx.font = "11px 'IBM Plex Sans Thai', sans-serif";
      ctx.fillText(
        `[${dim[0]}, ${dim[1]}, ${dim[2]}]  (M, L, T)`,
        px,
        py + panH * 0.74,
      );
    };

    drawPan(lx, ly, `ฝั่งซ้าย: ${equation.lhs.map((f) => QUANTITIES[f.key].symbol + (f.power && f.power !== 1 ? supTxt(f.power) : "")).join("·") || "—"}`, formatDimText(lhs), lhs);
    drawPan(rx, ry, `ฝั่งขวา: ${equation.rhs.map((f) => QUANTITIES[f.key].symbol + (f.power && f.power !== 1 ? supTxt(f.power) : "")).join("·") || "—"}`, formatDimText(rhs), rhs);

    // --- verdict banner on canvas ---
    drawLabel(
      ctx,
      bal ? "✓ มิติสมดุล — สมมูล" : "✗ มิติไม่สมดุล — ไม่สมมูล",
      cx,
      height * 0.07,
      {
        align: "center",
        color: "#fff",
        bg: bal ? "rgba(5,150,105,0.92)" : "rgba(225,29,72,0.92)",
        font: "bold 14px 'IBM Plex Sans Thai', sans-serif",
      },
    );
  };

  const verdictTh = balanced ? "✓ สมมูล" : "✗ ไม่สมมูล";
  const verdictEn = balanced ? "Homogeneous" : "Not homogeneous";
  const tone: "emerald" | "rose" = balanced ? "emerald" : "rose";
  const accentClass = balanced
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";

  const explanation = balanced
    ? `สมการ ${equation.display} มีมิติทั้งสองข้างเท่ากันที่ ${formatDim(lhsDim)} จึงเป็นสมการที่สมมูลทางมิติ (dimensional homogeneity) — ผ่านการตรวจสอบเบื้องต้น เช่น P = ρgh ที่มิติ ${formatDim(QUANTITIES.P.dim)} เท่ากันทั้งสองข้าง`
    : `สมการ ${equation.display} มีมิติฝั่งซ้าย ${formatDim(lhsDim)} แต่ฝั่งขวา ${formatDim(rhsDim)} ไม่เท่ากัน จึงไม่สมมูลทางมิติและเป็นไปไม่ได้ทางฟิสิกส์ — สมการที่ถูกต้องต้องมีมิติทั้งสองข้างเท่ากัน เช่น P = ρgh ส่วน P = ρg ไม่สมดุล`;

  const availableToggles = ["formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ eqIndex: result.eqIndex, balanced: result.balanced }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <ResultStat label="ผลตรวจสอบ Verdict" value={`${verdictTh} (${verdictEn})`} big accentClass={accentClass} />
        </div>
        <ResultStat label="มิติฝั่งซ้าย LHS" value={formatDim(lhsDim)} accentClass={accentClass} />
        <ResultStat label="มิติฝั่งขวา RHS" value={formatDim(rhsDim)} accentClass={accentClass} />
        <div className="col-span-2">
          <ResultStat label="สมการที่เลือก Equation" value={equation.display} />
        </div>
      </div>

      <ExplanationPanel text={explanation} badge={{ label: `${verdictTh} ${verdictEn}`, tone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="[ฝั่งซ้าย] = [ฝั่งขวา]   (Dimensional Homogeneity)"
          substituted={`${equation.display}  →  ${formatDim(lhsDim)} ${balanced ? "=" : "≠"} ${formatDim(rhsDim)}`}
          variables={BASE_DIMENSIONS.map((b) => ({
            symbol: b.symbol,
            meaning: `${b.th} ${b.en}`,
          }))}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            มิติฐาน 3 ตัว: มวล [M] · ความยาว [L] · เวลา [T] — ทุกปริมาณเขียนเป็น Mᵃ Lᵇ Tᶜ ได้ การคูณปริมาณ = บวกเลขชี้กำลัง, การยกกำลัง = คูณเลขชี้กำลัง สมการจะถูกต้องก็ต่อเมื่อมิติทั้งสองข้างเท่ากัน
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {Object.values(QUANTITIES).map((q) => (
              <div key={q.key} className="flex items-baseline gap-1.5">
                <dt className="font-mono font-semibold text-flow-600 dark:text-flow-300">{q.symbol}</dt>
                <dd className="text-ink-soft">
                  {q.th} {formatDim(q.dim)}
                </dd>
              </div>
            ))}
          </dl>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ตารางเลขชี้กำลัง [M, L, T] ทั้งสองข้าง">
          <DimBarTable lhs={lhsDim} rhs={rhsDim} balanced={balanced} />
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ตรวจสอบมิติ"
      titleEn="Dimensional Homogeneity Checker"
      icon="⚖️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              เลือกสมการที่จะตรวจสอบ Equation
            </div>
            <div className="flex flex-wrap gap-2">
              {EQUATIONS.map((eq, idx) => (
                <ToggleChip
                  key={eq.id}
                  label={eq.display}
                  icon={eq.balanced ? "✓" : "✗"}
                  active={idx === eqIndex}
                  onClick={() => setEqIndex(idx)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              เลือกสมการแล้วดูคานสมดุล: มิติตรงกัน → คานระดับ (เขียว) · ไม่ตรง → คานเอียง (แดง)
            </p>
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-dimcheck">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="คานชั่งเปรียบเทียบมิติทั้งสองข้างของสมการ — ระดับเมื่อมิติเท่ากัน เอียงเมื่อไม่เท่ากัน"
          />
        </SimStage>
      }
      results={<div id="explain-dimcheck">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}

/** Render an exponent as small unicode superscript text (for pan factor labels). */
function supTxt(p: number): string {
  if (p === 0.5) return "^½";
  if (p === 2) return "²";
  if (p === 3) return "³";
  return `^${p}`;
}

/** Format a dimension into the on-pan "[M^a L^b T^c]" full-vector style. */
function formatDimText(dim: Dim): string {
  return `[${formatDimFull(dim)}]`;
}

/** A small bar/badge table showing each base-dimension exponent per side. */
function DimBarTable({ lhs, rhs, balanced }: { lhs: Dim; rhs: Dim; balanced: boolean }) {
  const okClass = "text-emerald-600 dark:text-emerald-300";
  const badClass = "text-rose-600 dark:text-rose-300";
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-4 gap-2 font-semibold text-ink-faint">
        <span>มิติ</span>
        <span className="text-center">ฝั่งซ้าย</span>
        <span className="text-center">ฝั่งขวา</span>
        <span className="text-center">ตรงกัน?</span>
      </div>
      {BASE_DIMENSIONS.map((b, i) => {
        const match = lhs[i] === rhs[i];
        return (
          <div key={b.symbol} className="grid grid-cols-4 items-center gap-2">
            <span className="text-ink-soft">
              {b.symbol} ({b.th})
            </span>
            <span className="text-center font-mono text-ink">{lhs[i]}</span>
            <span className="text-center font-mono text-ink">{rhs[i]}</span>
            <span className={`text-center font-bold ${match ? okClass : badClass}`}>
              {match ? "✓" : "✗"}
            </span>
          </div>
        );
      })}
      <p className={`pt-1 text-center font-semibold ${balanced ? okClass : badClass}`}>
        {balanced ? "✓ ทุกมิติเท่ากัน → สมมูล" : "✗ มีมิติที่ไม่ตรงกัน → ไม่สมมูล"}
      </p>
    </div>
  );
}
