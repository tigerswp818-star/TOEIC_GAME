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
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  solveSimilarity,
  seedParticles,
  type SimilarityKind,
  type SimParticle,
} from "./similarityModel";

const PARTICLE_COUNT = 90; // per object
const SPEED = 0.06; // normalised xf per second per (m/s)

interface Params {
  lp: number; // prototype length L_p (m)
  vp: number; // prototype velocity V_p (m/s)
  lambda: number; // scale λ = L_m / L_p
}
const DEFAULTS: Params = { lp: 30, vp: 8, lambda: 0.1 };

const KIND_LABEL: Record<SimilarityKind, string> = {
  reynolds: "Reynolds (Re)",
  froude: "Froude (Fr)",
};

const guidedSteps: GuidedStep[] = [
  {
    title: "ของจริงกับแบบจำลอง",
    body: "ฝั่งซ้ายคือ 'ของจริง' (Prototype) ขนาดใหญ่ ฝั่งขวาคือ 'แบบจำลอง' (Model) ที่ย่อขนาดด้วยสเกล λ — เป้าหมายคือทำให้แบบจำลองมีพฤติกรรมเหมือนของจริง โดยรักษาตัวเลขไร้มิติให้เท่ากัน",
    apply: { lp: 30, vp: 8, lambda: 0.1 },
  },
  {
    title: "Reynolds — วัตถุจม",
    body: "เลือก Reynolds สำหรับวัตถุที่จมอยู่ในของไหล (ท่อ/ตัวเรือใต้น้ำ) ใช้ของไหลเดียวกัน ต้องเร่งความเร็วแบบจำลองเป็น V_m = V_p/λ สังเกตว่าค่า Re ใต้ทั้งสองภาพอ่านได้เท่ากัน",
    apply: { lp: 30, vp: 8, lambda: 0.1 },
  },
  {
    title: "Froude — ผิวอิสระ/เรือ",
    body: "สลับเป็น Froude สำหรับการไหลที่มีผิวอิสระและคลื่น (เรือผิวน้ำ) ความเร็วแบบจำลองต้องลดลงเป็น V_m = V_p·√λ คราวนี้ค่า Fr ของทั้งสองภาพจะเท่ากัน",
    apply: { lp: 30, vp: 8, lambda: 0.1 },
  },
  {
    title: "เปลี่ยนสเกล λ",
    body: "ลองเลื่อนสเกล λ ให้เล็กลง (เช่น 1:25) แบบจำลองจะยิ่งเล็ก และความเร็วที่ต้องใช้จะเปลี่ยนตามสูตร แต่ตัวเลขไร้มิติยังคงเท่ากันเสมอ นี่คือหัวใจของ dynamic similarity",
    apply: { lp: 30, vp: 8, lambda: 0.04 },
  },
];

// Challenge predicates run over { vModel, numberMatch, lambda }.
const challenges: Challenge[] = [
  {
    id: "scale-1-20",
    title: "ตั้งสเกล 1:20 (λ = 0.05) แล้วอ่านค่า V_m",
    hint: "เลื่อนสเกล λ ให้เท่ากับ 0.05 พอดี (1 ส่วนใน 20)",
    isSolved: (r) => Math.abs(r.lambda - 0.05) < 0.005,
    success: "เยี่ยม! ที่สเกล 1:20 อ่านความเร็วแบบจำลอง V_m ได้จากแผงผลลัพธ์",
  },
  {
    id: "fast-model",
    title: "ทำให้แบบจำลองต้องวิ่งเร็วกว่าของจริง (V_m > V_p)",
    hint: "เฉพาะ Reynolds เท่านั้นที่ V_m = V_p/λ > V_p เพราะ λ < 1 ลองสลับเป็น Reynolds",
    isSolved: (r) => r.vModel > r.vp + 1e-6,
    success: "ถูกต้อง! Reynolds similarity ทำให้แบบจำลองเล็กต้องวิ่งเร็วขึ้น",
  },
  {
    id: "match",
    title: "ทำให้ตัวเลขไร้มิติของของจริงและแบบจำลองเท่ากัน",
    hint: "ไม่ว่าจะเลือก Reynolds หรือ Froude สูตร V_m ที่คำนวณให้จะทำให้ตัวเลขเท่ากันโดยอัตโนมัติ",
    isSolved: (r) => r.numberMatch > 0.5,
    success: "นี่แหละ dynamic similarity — ตัวเลขไร้มิติของทั้งสองอ่านได้เท่ากันพอดี",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ทำไมแบบจำลองต้องรักษาตัวเลขไร้มิติ (เช่น Re หรือ Fr) ให้เท่ากับของจริง?",
    choices: [
      "เพื่อให้แบบจำลองมีพฤติกรรมการไหลเหมือนของจริง (dynamic similarity)",
      "เพื่อให้แบบจำลองมีสีเหมือนของจริง",
      "เพื่อประหยัดน้ำในการทดลอง",
      "เพราะกฎหมายกำหนด",
    ],
    answer: 0,
    explain: "เมื่อตัวเลขไร้มิติเท่ากัน อัตราส่วนของแรงต่าง ๆ ในแบบจำลองจะเหมือนของจริง ผลการทดสอบจึงนำไปทำนายของจริงได้ นี่คือ dynamic similarity",
  },
  {
    question: "การทดสอบ 'เรือผิวน้ำ' ควรใช้ตัวเลขไร้มิติใดในการทำให้เหมือนของจริง?",
    choices: ["Reynolds number", "Froude number", "Mach number", "ไม่ต้องใช้เลย"],
    answer: 1,
    explain: "เรือผิวน้ำมีผิวอิสระและสร้างคลื่น แรงโน้มถ่วงจึงสำคัญ ใช้ Froude number Fr = V/√(gL) เป็นตัวคุม ส่วน Reynolds ใช้กับวัตถุที่จมมิด",
  },
  {
    question: "'Dynamic similarity' ระหว่างแบบจำลองกับของจริง หมายความว่าอย่างไร?",
    choices: [
      "รูปร่างเหมือนกันเท่านั้น",
      "ขนาดเท่ากันพอดี",
      "อัตราส่วนของแรงเหมือนกัน โดยตัวเลขไร้มิติที่ควบคุมเท่ากัน",
      "ใช้ของไหลชนิดเดียวกันเสมอ",
    ],
    answer: 2,
    explain: "Dynamic similarity คือการที่อัตราส่วนของแรงต่าง ๆ (เฉื่อย/หนืด/โน้มถ่วง) เหมือนกัน ซึ่งทำได้โดยรักษาตัวเลขไร้มิติที่ควบคุม (Re หรือ Fr) ให้เท่ากัน",
  },
];

export default function SimilaritySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [kind, setKind] = useState<SimilarityKind>("reynolds");
  const [mode, setMode] = useState<LearningMode>("explore");

  const protoParticlesRef = useRef<SimParticle[]>(seedParticles(PARTICLE_COUNT));
  const modelParticlesRef = useRef<SimParticle[]>(seedParticles(PARTICLE_COUNT));

  const result = solveSimilarity(kind, params.lp, params.vp, params.lambda);
  const { lm, vm, numberProto, numberModel } = result;

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ vp: params.vp, vm, kind, numberProto, numberModel });
  physicsRef.current = { vp: params.vp, vm, kind, numberProto, numberModel };

  useEffect(() => {
    protoParticlesRef.current = seedParticles(PARTICLE_COUNT);
    modelParticlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { vp, vm, kind: k, numberProto, numberModel } = physicsRef.current;

    // Two side-by-side panels: prototype (left), model (right).
    const gap = width * 0.06;
    const panelW = (width - gap) / 2;
    const panels = [
      {
        x0: 0,
        w: panelW,
        objHalf: 0.34, // object size as fraction of panel height
        vel: vp,
        particles: protoParticlesRef.current,
        title: "ของจริง Prototype",
        numberVal: numberProto,
      },
      {
        x0: panelW + gap,
        w: panelW,
        objHalf: 0.34 * 0.55, // model is visibly smaller (scaled look)
        vel: vm,
        particles: modelParticlesRef.current,
        title: "แบบจำลอง Model",
        numberVal: numberModel,
      },
    ];

    // Common reference velocity for colour normalisation across both panels.
    const maxVel = Math.max(vp, vm, 1e-6);
    const numLabel = k === "reynolds" ? "Re" : "Fr";

    for (const p of panels) {
      const cx = p.x0 + p.w / 2;
      const centerY = height * 0.46;
      const bandHalf = height * 0.34;
      const top = centerY - bandHalf;
      const bot = centerY + bandHalf;

      // --- flow band background ---
      ctx.beginPath();
      ctx.rect(p.x0, top, p.w, bandHalf * 2);
      const grad = ctx.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, dark ? "rgba(14,116,144,0.16)" : "rgba(165,243,252,0.38)");
      grad.addColorStop(1, dark ? "rgba(6,30,55,0.30)" : "rgba(207,250,254,0.48)");
      ctx.fillStyle = grad;
      ctx.fill();

      // band edges (free surface look on top)
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(p.x0, top);
      ctx.lineTo(p.x0 + p.w, top);
      ctx.moveTo(p.x0, bot);
      ctx.lineTo(p.x0 + p.w, bot);
      ctx.stroke();

      // --- the object: a ship-hull / cylinder silhouette, scaled per panel ---
      const objH = bandHalf * 2 * p.objHalf;
      const objW = objH * 1.7;
      const oy = centerY;
      ctx.save();
      ctx.fillStyle = dark ? "rgba(148,163,184,0.85)" : "rgba(71,85,105,0.85)";
      ctx.strokeStyle = dark ? "#cbd5e1" : "#334155";
      ctx.lineWidth = 2;
      // hull shape: rounded nose facing the flow (right), flat-ish stern (left)
      ctx.beginPath();
      ctx.moveTo(cx - objW / 2, oy - objH / 2);
      ctx.lineTo(cx + objW * 0.18, oy - objH / 2);
      ctx.quadraticCurveTo(cx + objW / 2, oy - objH / 2, cx + objW / 2, oy);
      ctx.quadraticCurveTo(cx + objW / 2, oy + objH / 2, cx + objW * 0.18, oy + objH / 2);
      ctx.lineTo(cx - objW / 2, oy + objH / 2);
      ctx.quadraticCurveTo(cx - objW * 0.72, oy, cx - objW / 2, oy - objH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // --- particles flow left→right, deflecting around the object ---
      for (const part of p.particles) {
        const dxf = p.vel * SPEED * dt;
        let nx = part.xf + dxf;
        if (nx > 1) {
          nx -= 1;
          part.f = (Math.random() * 2 - 1) * 0.92;
        }
        part.xf = nx;

        if (!controls.toggles.particles) continue;

        const px = p.x0 + part.xf * p.w;
        // deflect vertically near the object's horizontal centre band
        const distX = Math.abs(part.xf - 0.5);
        const near = clamp(1 - distX / 0.28, 0, 1);
        const push = near * (objH / 2 + 6) * Math.sign(part.f || 1);
        const py = centerY + part.f * (bandHalf * 0.9) + push * 0.5;
        const pyc = clamp(py, top + 2, bot - 2);

        ctx.beginPath();
        ctx.arc(px, pyc, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(Math.min(1, p.vel / maxVel), 0.95);
        ctx.fill();
      }

      // --- velocity vectors (length encodes the panel's speed) ---
      if (controls.toggles.vectors) {
        const len = clamp(p.vel * (p.w * 0.03), 12, p.w * 0.32);
        for (const yf of [-0.7, 0, 0.7]) {
          const vy = centerY + yf * bandHalf;
          drawArrow(ctx, p.x0 + 8, vy, p.x0 + 8 + len, vy, "#f59e0b", 2.2, 7);
        }
      }

      // --- panel title (top) ---
      drawLabel(ctx, p.title, cx, top - 14, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
        font: "bold 12px 'IBM Plex Sans Thai', sans-serif",
      });

      // --- velocity readout (inside band) ---
      drawLabel(ctx, `V = ${formatNumber(p.vel)} m/s`, cx, bot - 16, {
        align: "center",
        color: "#f8fafc",
        bg: "rgba(8,145,178,0.85)",
      });

      // --- matched dimensionless number (bottom, reads EQUAL) ---
      drawLabel(ctx, `${numLabel} = ${formatNumber(p.numberVal, 0)}`, cx, bot + 22, {
        align: "center",
        color: dark ? "#f8fafc" : "#0f172a",
        bg: "rgba(16,185,129,0.85)",
        font: "bold 13px 'IBM Plex Sans Thai', sans-serif",
      });
    }

    // "= equal" connector between the two number badges
    drawLabel(ctx, "=", width / 2, height * 0.46 + height * 0.34 + 22, {
      align: "center",
      color: dark ? "#f8fafc" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.9)",
      font: "bold 16px 'IBM Plex Sans Thai', sans-serif",
    });
  };

  const numLabel = kind === "reynolds" ? "Re" : "Fr";
  const explanation =
    kind === "reynolds"
      ? `เลือก Reynolds similarity สำหรับวัตถุที่จมในของไหล (ท่อ/ตัวเรือใต้น้ำ) — ใช้ของไหลเดียวกัน ต้องเร่งความเร็วแบบจำลองเป็น V_m = V_p/λ = ${formatNumber(vm)} m/s (เร็วกว่าของจริง เพราะแบบจำลองเล็กลง) เพื่อให้ ${numLabel} เท่ากันทั้งคู่ ≈ ${formatNumber(numberProto, 0)} เพื่อให้แบบจำลองเหมือนของจริง (dynamic similarity) ต้องรักษาตัวเลขไร้มิติให้เท่ากัน`
      : `เลือก Froude similarity สำหรับการไหลผิวอิสระ/เรือผิวน้ำ — ความเร็วแบบจำลองต้องลดลงเป็น V_m = V_p·√λ = ${formatNumber(vm)} m/s เพื่อให้ ${numLabel} เท่ากันทั้งคู่ ≈ ${formatNumber(numberProto, 2)} เพื่อให้แบบจำลองเหมือนของจริง (dynamic similarity) ต้องรักษาตัวเลขไร้มิติให้เท่ากัน — Reynolds ใช้กับวัตถุจม (V_m = V_p/λ), Froude ใช้กับการไหลผิวอิสระ/เรือ (V_m = V_p·√λ)`;

  // How closely the two numbers match (≈1 = perfect) for the challenge predicate.
  const numberMatch =
    Math.max(numberProto, numberModel) > 0
      ? Math.min(numberProto, numberModel) / Math.max(numberProto, numberModel)
      : 0;

  const availableToggles = ["particles", "vectors", "formula"] as const;

  const formulaMain =
    kind === "reynolds"
      ? "Re_m = Re_p  →  V_m = V_p · (L_p/L_m) = V_p / λ"
      : "Fr_m = Fr_p  →  V_m = V_p · √(L_m/L_p) = V_p · √λ";
  const formulaSub =
    kind === "reynolds"
      ? `V_m = ${formatNumber(params.vp)} / ${formatNumber(params.lambda)} = ${formatNumber(vm)} m/s   ·   Re = ${formatNumber(numberProto, 0)} (เท่ากันทั้งคู่)`
      : `V_m = ${formatNumber(params.vp)} · √${formatNumber(params.lambda)} = ${formatNumber(vm)} m/s   ·   Fr = ${formatNumber(numberProto, 2)} (เท่ากันทั้งคู่)`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      <div className="flex flex-wrap gap-2">
        <ToggleChip
          label="Reynolds (วัตถุจม)"
          icon="🌀"
          active={kind === "reynolds"}
          onClick={() => setKind("reynolds")}
        />
        <ToggleChip
          label="Froude (เรือ/ผิวอิสระ)"
          icon="🚢"
          active={kind === "froude"}
          onClick={() => setKind("froude")}
        />
      </div>

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ vModel: vm, vp: params.vp, lambda: params.lambda, numberMatch }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็วแบบจำลอง V_m"
          value={vm}
          unit="m/s"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat
          label={`ตัวเลขที่จับคู่ (${numLabel})`}
          value={numberProto}
          decimals={kind === "reynolds" ? 0 : 2}
        />
        <ResultStat label="ความยาวแบบจำลอง L_m" value={lm} unit="m" />
        <ResultStat label="สเกล λ (L_m/L_p)" value={params.lambda} decimals={2} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: KIND_LABEL[kind], tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula={formulaMain}
          substituted={formulaSub}
          variables={[
            { symbol: "Re", meaning: "เลขเรย์โนลด์ Reynolds number", unit: "—" },
            { symbol: "Fr", meaning: "เลขฟรูด Froude number", unit: "—" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "L", meaning: "ความยาวเฉพาะ Characteristic length", unit: "m" },
            { symbol: "λ", meaning: "สเกล Scale = L_m/L_p", unit: "—" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            Reynolds → วัตถุจม (V_m = V_p/λ) · Froude → ผิวอิสระ/เรือ (V_m = V_p·√λ)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title={`ตัวเลขไร้มิติ ${numLabel} — ของจริง vs แบบจำลอง`}>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface px-2 py-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">ของจริง</div>
              <div className="mt-1 font-mono text-lg font-bold text-flow-600 dark:text-flow-300">
                {formatNumber(numberProto, kind === "reynolds" ? 0 : 2)}
              </div>
            </div>
            <div className="rounded-lg bg-surface px-2 py-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">แบบจำลอง</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-300">
                {formatNumber(numberModel, kind === "reynolds" ? 0 : 2)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            ✅ ค่าทั้งสองเท่ากัน = แบบจำลองเหมือนของจริง (dynamic similarity)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แบบจำลองกับของจริง"
      titleEn="Model & Prototype Similarity"
      icon="🚢"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความยาวของจริง"
            symbol="L_p"
            value={params.lp}
            min={1}
            max={100}
            step={1}
            unit="m"
            decimals={0}
            onChange={set("lp")}
          />
          <ControlSlider
            label="ความเร็วของจริง"
            symbol="V_p"
            value={params.vp}
            min={1}
            max={20}
            step={0.1}
            unit="m/s"
            onChange={set("vp")}
          />
          <ControlSlider
            label="สเกล (L_m/L_p)"
            symbol="λ"
            value={params.lambda}
            min={0.02}
            max={0.5}
            step={0.01}
            decimals={2}
            onChange={set("lambda")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-similarity">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของจริงขนาดใหญ่และแบบจำลองขนาดเล็กไหลผ่านด้วยความเร็วต่างกัน แต่ตัวเลขไร้มิติเท่ากัน"
          />
        </SimStage>
      }
      results={<div id="explain-similarity">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
