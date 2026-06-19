import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
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
  velocityAt,
  vorticity,
  spinRate,
  representativeVorticity,
  isRotational,
  fieldLabel,
  seedWheels,
  recycleWheel,
  FIELD_ORDER,
  type FieldKind,
  type FieldParams,
  type PaddleWheel,
} from "./rotationalModel";

/** Half-extent of the centred world box (world units). */
const WORLD_HALF = 5;
/** Paddle-wheel grid resolution. */
const WHEEL_COLS = 9;
const WHEEL_ROWS = 6;
/** World-units → px advection scale per second. */
const FIELD_SPEED = 26;

interface Params {
  /** Field strength: U / Γ / ω depending on the field kind. */
  strength: number;
  /** Shear velocity gradient k (only used by the shear field). */
  gradient: number;
}
const DEFAULTS: Params = { strength: 2.0, gradient: 1.2 };

const FIELDS: { id: FieldKind; label: string; icon: string }[] = [
  { id: "uniform", label: "สม่ำเสมอ Uniform", icon: "➡️" },
  { id: "free", label: "วอร์เท็กซ์อิสระ Free", icon: "🌀" },
  { id: "forced", label: "วอร์เท็กซ์บังคับ Forced", icon: "🔄" },
  { id: "shear", label: "เฉือน Shear", icon: "↗️" },
];

const guidedSteps: GuidedStep[] = [
  {
    title: "การไหลสม่ำเสมอ — ใบพัดไม่หมุน",
    body: "เริ่มจากสนามความเร็วสม่ำเสมอ u = (U, 0) ใบพัดทุกตัวเคลื่อนที่ไปทางขวาพร้อมกัน แต่ 'ไม่หมุน' เลย เพราะ vorticity = 0 นี่คือการไหลแบบ irrotational",
    apply: { field: 0, strength: 2.0, gradient: 1.2 },
  },
  {
    title: "วอร์เท็กซ์อิสระ — เคลื่อนวนแต่ไม่หมุน",
    body: "เปลี่ยนเป็น free vortex (vθ = Γ/2πr) ใบพัดเคลื่อนที่เป็นวงรอบศูนย์กลางตามเส้นการไหลที่โค้ง แต่ตัวใบพัดเองยังคง 'ไม่หมุน' (vorticity = 0 ทุกที่ยกเว้นแกนกลาง) — เส้นการไหลโค้งไม่ได้แปลว่าหมุน!",
    apply: { field: 1, strength: 6.0, gradient: 1.2 },
  },
  {
    title: "วอร์เท็กซ์บังคับ — ใบพัดหมุนทั้งสนาม",
    body: "เปลี่ยนเป็น forced vortex (vθ = ω·r) ของไหลหมุนรวมกันแบบวัตถุแข็ง คราวนี้ใบพัด 'หมุน' ชัดเจนทุกตัว เพราะ vorticity = 2ω ทุกจุด อัตราการหมุนของใบพัด = ω",
    apply: { field: 2, strength: 2.0, gradient: 1.2 },
  },
  {
    title: "การไหลแบบเฉือน + สรุป",
    body: "สนามเฉือน u = (k·y, 0) เส้นการไหลตรงแต่ความเร็วต่างกันตามระดับ ทำให้ใบพัด 'หมุน' (vorticity = −k) สรุป: ใบพัดหมุนก็ต่อเมื่อของไหลมี vorticity (rotational) ไม่ได้ขึ้นกับว่าเส้นการไหลโค้งหรือไม่",
    apply: { field: 3, strength: 2.0, gradient: 1.8 },
  },
];

const challenges: Challenge[] = [
  {
    id: "spin",
    title: "เลือกสนามที่ทำให้ใบพัดหมุน (rotational)",
    hint: "ลองเปลี่ยนเป็น forced vortex (solid body) หรือ shear flow — ทั้งสองมี vorticity ไม่เป็นศูนย์",
    isSolved: (r) => r.isRotational === 1,
    success: "ถูกต้อง! สนามนี้มี vorticity ใบพัดจึงหมุน — เป็นการไหลแบบ rotational",
  },
  {
    id: "noSpin",
    title: "เลือกสนามที่ใบพัดไม่หมุน (irrotational)",
    hint: "uniform หรือ free vortex ก็ได้ — แม้ free vortex เส้นการไหลจะโค้ง แต่ vorticity = 0 ใบพัดจึงไม่หมุน",
    isSolved: (r) => r.isRotational === 0,
    success: "เยี่ยม! สนามนี้ vorticity = 0 ใบพัดเคลื่อนที่แต่ไม่หมุน — irrotational",
  },
  {
    id: "free",
    title: "หาสนามที่ 'เส้นการไหลโค้งแต่ใบพัดไม่หมุน'",
    hint: "นี่คือกรณีพิเศษของ free vortex (kind = 1): เคลื่อนวนเป็นวงแต่ไม่หมุนรอบตัวเอง",
    isSolved: (r) => r.kind === 1 && r.isRotational === 0,
    success: "ใช่เลย! free vortex เป็น irrotational ทั้งที่เส้นการไหลโค้ง — นี่คือหัวใจของบทเรียน",
  },
];

const quiz: QuizItem[] = [
  {
    question: "อะไรทำให้ใบพัด (paddle wheel) ในสนามการไหลหมุนรอบตัวเอง?",
    choices: [
      "เส้นการไหลโค้ง",
      "ของไหลมี vorticity (∂v/∂x − ∂u/∂y ≠ 0)",
      "ความเร็วของไหลสูง",
      "ความดันของไหลสูง",
    ],
    answer: 1,
    explain: "ใบพัดจะหมุนก็ต่อเมื่อของไหลมี vorticity (rotational) อัตราการหมุน = ω_z/2 เส้นการไหลโค้งหรือความเร็วสูงไม่ได้การันตีว่าจะหมุน",
  },
  {
    question: "วอร์เท็กซ์อิสระ (free vortex, vθ = Γ/2πr) เป็นการไหลแบบใด?",
    choices: [
      "Rotational ทุกที่",
      "Irrotational ทุกที่ ยกเว้นที่แกนกลาง",
      "Irrotational เฉพาะที่แกนกลาง",
      "ไม่มีการเคลื่อนที่",
    ],
    answer: 1,
    explain: "free vortex มี vorticity = 0 ทุกจุด (ยกเว้นจุดศูนย์กลางที่เป็น singular) ใบพัดจึงเคลื่อนวนเป็นวงรอบศูนย์กลางแต่ไม่หมุนรอบตัวเอง",
  },
  {
    question: "vorticity (ω_z) ในเชิงกายภาพหมายถึงอะไร?",
    choices: [
      "ความเร็วเฉลี่ยของของไหล",
      "สองเท่าของอัตราการหมุนของธาตุของไหล (ω_z = 2 × spin)",
      "ความดันของของไหล",
      "อัตราการไหลเชิงปริมาตร",
    ],
    answer: 1,
    explain: "vorticity ω_z = ∂v/∂x − ∂u/∂y วัด 'การหมุนเฉพาะที่' ของธาตุของไหล โดยอัตราการหมุนของธาตุ (spin) = ω_z/2 ถ้า ω_z = 0 คือ irrotational",
  },
];

export default function RotationalSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [field, setField] = useState<FieldKind>("forced");
  const [mode, setMode] = useState<LearningMode>("explore");

  const wheelsRef = useRef<PaddleWheel[]>(seedWheels(WHEEL_COLS, WHEEL_ROWS, WORLD_HALF));

  // Derived physics for the result panel.
  const fieldParams: FieldParams = { strength: params.strength, gradient: params.gradient };
  const repVort = representativeVorticity(field, fieldParams);
  const rotational = isRotational(field, fieldParams);
  const spin = repVort / 2;
  const kindIndex = FIELD_ORDER.indexOf(field);

  // Keep the latest field/params available to the per-frame draw closure
  // without restarting the RAF loop (mirrors VortexSim.physicsRef).
  const liveRef = useRef({ field, fieldParams });
  liveRef.current = { field, fieldParams };

  // Re-seed paddle wheels when the user hits Reset.
  useEffect(() => {
    wheelsRef.current = seedWheels(WHEEL_COLS, WHEEL_ROWS, WORLD_HALF);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  // Guided presets carry a numeric `field` sentinel (the shared GuidedSteps
  // component only passes numbers) so they can also switch the active field.
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.field === "number") setField(FIELD_ORDER[vals.field] ?? "uniform");
    setParams((p) => ({
      ...p,
      ...(typeof vals.strength === "number" ? { strength: vals.strength } : {}),
      ...(typeof vals.gradient === "number" ? { gradient: vals.gradient } : {}),
    }));
  };

  /** Draw a 4-spoke paddle-wheel glyph at (px, py) with rotation `ang`. */
  const drawWheel = (
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    radius: number,
    ang: number,
    color: string,
  ) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    // four spokes (a cross)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.stroke();
    }
    // hub
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { field: fk, fieldParams: fp } = liveRef.current;
    const dark = t === "dark";
    const cx = width / 2;
    const cy = height / 2;
    const pxPerWorld = Math.min(width, height) / (2 * WORLD_HALF);
    // World (x,y) → screen px. Screen y is down, so negate y to keep maths up.
    const toX = (x: number) => cx + x * pxPerWorld;
    const toY = (y: number) => cy - y * pxPerWorld;

    // Normalisation reference for colours: a strong sample speed in the field.
    const refSpeed = (() => {
      const v = velocityAt(WORLD_HALF * 0.6, WORLD_HALF * 0.6, fk, fp);
      return Math.max(Math.hypot(v.vx, v.vy), 0.4);
    })();

    // --- background panel ---
    ctx.fillStyle = dark ? "rgba(6,30,55,0.25)" : "rgba(207,250,254,0.35)";
    ctx.fillRect(0, 0, width, height);

    // --- context streamlines (integrate the field forward from a seed grid) ---
    if (controls.toggles.streamlines) {
      const seeds = 7;
      for (let a = 0; a < seeds; a++) {
        for (let b = 0; b < seeds; b++) {
          // seed only on a sparse lattice to keep it light
          if ((a + b) % 2 !== 0) continue;
          let x = -WORLD_HALF + (a / (seeds - 1)) * 2 * WORLD_HALF;
          let y = -WORLD_HALF + (b / (seeds - 1)) * 2 * WORLD_HALF;
          ctx.beginPath();
          ctx.moveTo(toX(x), toY(y));
          let drew = false;
          for (let s = 0; s < 26; s++) {
            const v = velocityAt(x, y, fk, fp);
            const sp = Math.hypot(v.vx, v.vy);
            if (sp < 1e-4) break;
            const step = 0.18;
            x += (v.vx / sp) * step;
            y += (v.vy / sp) * step;
            if (Math.abs(x) > WORLD_HALF * 1.2 || Math.abs(y) > WORLD_HALF * 1.2) break;
            ctx.lineTo(toX(x), toY(y));
            drew = true;
          }
          if (drew) {
            ctx.strokeStyle = dark ? "rgba(103,232,249,0.25)" : "rgba(8,145,178,0.25)";
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }
    }

    // --- velocity vectors (sparse grid for context) ---
    if (controls.toggles.vectors) {
      const gx = 7;
      const gy = 5;
      for (let i = 0; i < gx; i++) {
        for (let j = 0; j < gy; j++) {
          const x = -WORLD_HALF + ((i + 0.5) / gx) * 2 * WORLD_HALF;
          const y = -WORLD_HALF + ((j + 0.5) / gy) * 2 * WORLD_HALF;
          const v = velocityAt(x, y, fk, fp);
          const sp = Math.hypot(v.vx, v.vy);
          if (sp < 1e-4) continue;
          const len = clamp((sp / refSpeed) * 18, 5, 26);
          const inv = len / sp;
          drawArrow(
            ctx,
            toX(x),
            toY(y),
            toX(x) + v.vx * inv,
            toY(y) - v.vy * inv, // screen y inverted
            "#f59e0b",
            1.4,
            5,
          );
        }
      }
    }

    // --- paddle wheels: advect centre by velocity, rotate by spinRate ---
    const wheels = wheelsRef.current;
    const wheelPx = pxPerWorld * 0.35;
    for (const w of wheels) {
      const v = velocityAt(w.x, w.y, fk, fp);
      // advect the centre (dt = 0 when paused → holds still)
      w.x += (v.vx * FIELD_SPEED * dt) / pxPerWorld;
      w.y += (v.vy * FIELD_SPEED * dt) / pxPerWorld;
      // spin the glyph by the local angular velocity of a fluid element.
      // screen y is inverted, so a positive (CCW) spin reads clockwise on
      // screen — negate to keep the visual sense matching the maths.
      const sp = spinRate(w.x, w.y, fk, fp);
      w.angle -= sp * dt;
      recycleWheel(w, WORLD_HALF);

      if (!controls.toggles.particles) continue;

      const speed = Math.hypot(v.vx, v.vy);
      drawWheel(
        ctx,
        toX(w.x),
        toY(w.y),
        wheelPx,
        w.angle,
        velocityColor(clamp(speed / refSpeed, 0, 1), 0.95),
      );
    }

    // --- centre marker for the vortex fields ---
    if (fk === "free" || fk === "forced") {
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
      ctx.fill();
    }

    // --- regime label ---
    const rot = Math.abs(vorticity(1, 1, fk, fp)) > 1e-9;
    drawLabel(
      ctx,
      rot ? "Rotational — ใบพัดหมุน" : "Irrotational — ใบพัดไม่หมุน",
      cx,
      18,
      {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      },
    );
  };

  const explanation = rotational
    ? `สนาม '${fieldLabel(field)}' มี vorticity ω_z ≈ ${formatNumber(repVort)} 1/s (ไม่เป็นศูนย์) ของไหลจึงเป็นแบบ Rotational ใบพัดทุกตัว 'หมุน' รอบตัวเองด้วยอัตรา spin = ω_z/2 ≈ ${formatNumber(spin)} rad/s — การไหลแบบ Rotational ใบพัดหมุน เพราะของไหลมี vorticity`
    : field === "free"
      ? `สนาม '${fieldLabel(field)}' เส้นการไหลโค้งเป็นวง แต่ vorticity = 0 ทุกที่ (ยกเว้นแกนกลาง) จึงเป็นแบบ Irrotational ใบพัดเคลื่อนที่วนรอบศูนย์กลาง 'แต่ไม่หมุน' รอบตัวเอง — การไหลแบบ Irrotational ใบพัดเคลื่อนที่แต่ไม่หมุน (vorticity = 0)`
      : `สนาม '${fieldLabel(field)}' มี vorticity = 0 จึงเป็นแบบ Irrotational ใบพัดเคลื่อนที่ไปพร้อมกระแสแต่ 'ไม่หมุน' รอบตัวเอง — การไหลแบบ Irrotational ใบพัดเคลื่อนที่แต่ไม่หมุน (vorticity = 0)`;

  const availableToggles = ["particles", "streamlines", "vectors", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ isRotational: rotational ? 1 : 0, kind: kindIndex, vorticity: repVort, spin }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="สถานะการไหล"
          value={rotational ? "Rotational (หมุน)" : "Irrotational (ไม่หมุน)"}
          big
          accentClass={rotational ? "text-flow-600 dark:text-flow-300" : "text-emerald-600 dark:text-emerald-300"}
        />
        <ResultStat label="ชนิดสนามการไหล" value={fieldLabel(field)} />
        <ResultStat label="vorticity ω_z (ตัวแทน)" value={repVort} unit="1/s" />
        <ResultStat label="อัตราการหมุนใบพัด spin" value={spin} unit="rad/s" />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: rotational ? "Rotational — ใบพัดหมุน" : "Irrotational — ไม่หมุน",
          tone: rotational ? "cyan" : "emerald",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="ω_z = ∂v/∂x − ∂u/∂y   ·   spin = ω_z/2"
          substituted={`สนามนี้: ω_z ≈ ${formatNumber(repVort)} 1/s  →  spin = ω_z/2 ≈ ${formatNumber(spin)} rad/s  (${rotational ? "หมุน" : "ไม่หมุน"})`}
          variables={[
            { symbol: "ω_z", meaning: "vorticity (การหมุนเฉพาะที่)", unit: "1/s" },
            { symbol: "u", meaning: "ความเร็วในแนวแกน x", unit: "m/s" },
            { symbol: "v", meaning: "ความเร็วในแนวแกน y", unit: "m/s" },
            { symbol: "spin", meaning: "อัตราการหมุนของธาตุของไหล", unit: "rad/s" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            ใบพัดหมุนก็ต่อเมื่อ ω_z ≠ 0 (rotational) · free vortex เส้นการไหลโค้งแต่ ω_z = 0 จึง irrotational · forced vortex ω_z = 2ω · shear ω_z = −k
          </p>
        </FormulaCard>
      )}

      <div className="rounded-xl border border-line bg-surface-soft p-3 text-[11px] leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">คำอธิบายภาพ:</span> สี่เหลี่ยมกากบาท = ใบพัด (paddle wheel) · ใบพัดเคลื่อนที่ตามกระแส และจะ 'หมุน' รอบตัวเองเฉพาะเมื่อของไหลมี vorticity · 🟧 ลูกศร = เวกเตอร์ความเร็ว · เส้นจาง = เส้นการไหล (streamlines)
      </div>
    </>
  );

  return (
    <SimulationLayout
      title="Rotational vs Irrotational"
      titleEn="Vorticity & Paddle Wheels"
      icon="🔄"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">ชนิดสนามการไหล Field</span>
            <div className="flex flex-wrap gap-2">
              {FIELDS.map((f) => (
                <ToggleChip
                  key={f.id}
                  label={f.label}
                  icon={f.icon}
                  active={field === f.id}
                  onClick={() => setField(f.id)}
                />
              ))}
            </div>
          </div>

          <ControlSlider
            label={field === "free" ? "ความเข้มวอร์เท็กซ์ (Γ)" : field === "forced" ? "ความเร็วเชิงมุม (ω)" : field === "uniform" ? "ความเร็วกระแส (U)" : "ความแรงสนาม"}
            symbol={field === "free" ? "Γ" : field === "forced" ? "ω" : "U"}
            value={params.strength}
            min={0.2}
            max={8}
            step={0.1}
            unit={field === "free" ? "m²/s" : field === "forced" ? "rad/s" : "m/s"}
            decimals={1}
            onChange={set("strength")}
          />
          {field === "shear" && (
            <ControlSlider
              label="เกรเดียนต์ความเร็ว (k)"
              symbol="k"
              value={params.gradient}
              min={0.2}
              max={3}
              step={0.1}
              unit="1/s"
              decimals={1}
              onChange={set("gradient")}
            />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-rotational">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="กริดของใบพัดเล็ก ๆ ในสนามความเร็ว ใบพัดหมุนเมื่อของไหลมี vorticity และเคลื่อนที่แต่ไม่หมุนในการไหลแบบ irrotational"
          />
        </SimStage>
      }
      results={<div id="explain-rotational">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
