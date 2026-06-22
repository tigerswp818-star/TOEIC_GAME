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
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, drawFlowParticle, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  velocityAt,
  maxSpeed,
  singularCount,
  hasSingularity,
  fieldLabel,
  fieldFormula,
  seedParticles,
  recycleParticle,
  FIELD_ORDER,
  type FieldKind,
  type FieldParams,
  type FieldParticle,
} from "./velocityFieldModel";

/** Half-extent of the centred world box (world units). */
const WORLD_HALF = 5;
/** Number of advected particles. */
const PARTICLE_COUNT = 240;
/** World-units → px advection scale per second. */
const FIELD_SPEED = 26;

interface Params {
  /** Primary strength: U / m / Γ depending on the field kind. */
  strength: number;
  /** Secondary strength: free-stream U for the combined field. */
  secondary: number;
}
const DEFAULTS: Params = { strength: 4.0, secondary: 1.5 };

const FIELDS: { id: FieldKind; label: string; icon: string }[] = [
  { id: "uniform", label: "สม่ำเสมอ Uniform", icon: "➡️" },
  { id: "source", label: "แหล่งกำเนิด Source", icon: "💥" },
  { id: "sink", label: "แหล่งดูด Sink", icon: "🕳️" },
  { id: "vortex", label: "วอร์เท็กซ์ Vortex", icon: "🌀" },
  { id: "combined", label: "ผสม Combined", icon: "🧩" },
];

const guidedSteps: GuidedStep[] = [
  {
    title: "การไหลสม่ำเสมอ (Uniform)",
    body: "เริ่มจากสนามสม่ำเสมอ u = (U, 0) ลูกศรความเร็วทุกตัวยาวเท่ากันและชี้ไปทางเดียวกัน อนุภาคไหลขนานกันไปทางขวา — ความเร็วคงที่ทุกจุด ไม่มีจุดเอกฐาน",
    apply: { field: 0, strength: 4.0, secondary: 1.5 },
  },
  {
    title: "แหล่งกำเนิด (Source) — ดันออก",
    body: "เปลี่ยนเป็น source: v_r = +m/(2πr) ของไหลพุ่งออกจากศูนย์กลางทุกทิศ ลูกศรยิ่งสั้นลงเมื่ออยู่ไกลออกไป (เร็วสูงสุดใกล้จุดศูนย์กลาง) — เป็นจุดเอกฐาน 1 จุด",
    apply: { field: 1, strength: 5.0, secondary: 1.5 },
  },
  {
    title: "แหล่งดูด (Sink) และวอร์เท็กซ์ (Vortex)",
    body: "sink ดูดของไหลเข้าหาศูนย์กลาง (ตรงข้ามกับ source) ส่วน vortex (v_θ = Γ/2πr) หมุนวนรอบศูนย์กลาง ความเร็วสูงสุดใกล้แกนกลางและลดลงตาม 1/r เปิดชั้น Vectors เพื่อดูทิศทาง",
    apply: { field: 3, strength: 5.0, secondary: 1.5 },
  },
  {
    title: "สนามผสม (Combined) + สรุป",
    body: "รวม source กับ uniform stream → เกิด Rankine half-body ของไหลจากแหล่งกำเนิดถูกพัดไปตามกระแสด้านขวา สรุป: สนามความเร็วบอก 'ความเร็วและทิศทาง' ที่ทุกจุด ลูกศรยิ่งยาว = ของไหลยิ่งเร็ว",
    apply: { field: 4, strength: 5.0, secondary: 2.0 },
  },
];

const challenges: Challenge[] = [
  {
    id: "vortex",
    title: "เลือกสนามวอร์เท็กซ์ (Vortex) ที่ของไหลหมุนวนรอบศูนย์กลาง",
    hint: "วอร์เท็กซ์มีความเร็วเชิงมุม v_θ = Γ/(2πr) — เลือก field 'วอร์เท็กซ์ Vortex' จาก ToggleChip",
    isSolved: (r) => r.kind === 3,
    success: "ถูกต้อง! วอร์เท็กซ์หมุนวนรอบศูนย์กลาง ความเร็วสูงสุดใกล้แกนกลาง (ลดลงตาม 1/r)",
  },
  {
    id: "source",
    title: "เลือกสนามแหล่งกำเนิด (Source) ที่ของไหลพุ่งออกทุกทิศ",
    hint: "source ดันของไหล 'ออก' จากศูนย์กลาง (v_r เป็นบวก) — เลือก field 'แหล่งกำเนิด Source'",
    isSolved: (r) => r.kind === 1,
    success: "เยี่ยม! source ดันของไหลออกจากศูนย์กลางทุกทิศทาง — sink คือสิ่งตรงข้าม (ดูดเข้า)",
  },
  {
    id: "combined",
    title: "สร้างสนามผสม (Combined) source + uniform ที่กระแสพอแรง (U ≥ 1.5)",
    hint: "เลือก field 'ผสม Combined' แล้วเพิ่มความแรงกระแสรอง U ให้ถึง 1.5 ขึ้นไป",
    isSolved: (r) => r.kind === 4 && r.secondary >= 1.5,
    success: "สำเร็จ! source + uniform รวมกันเป็น Rankine half-body — สนามผสมจากบล็อกพื้นฐานหลายตัว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "สนามแบบ 'source' (แหล่งกำเนิด) ทำอะไรกับของไหล?",
    choices: [
      "ดันของไหลออกจากศูนย์กลางทุกทิศทาง",
      "ดูดของไหลเข้าหาศูนย์กลาง",
      "หมุนของไหลวนรอบศูนย์กลาง",
      "ทำให้ของไหลหยุดนิ่ง",
    ],
    answer: 0,
    explain: "source มีความเร็วเชิงรัศมี v_r = +m/(2πr) ชี้ออกจากศูนย์กลาง ของไหลจึงพุ่งกระจายออกทุกทิศ ส่วน sink คือสิ่งตรงข้ามที่ดูดเข้า",
  },
  {
    question: "ในสนามวอร์เท็กซ์ (vortex, v_θ = Γ/2πr) ความเร็วของไหลสูงสุดที่ตำแหน่งใด?",
    choices: [
      "ไกลจากศูนย์กลางมาก ๆ",
      "ใกล้ศูนย์กลาง (r เล็ก)",
      "เท่ากันทุกที่",
      "ที่ขอบสนามเท่านั้น",
    ],
    answer: 1,
    explain: "v_θ = Γ/(2πr) แปรผกผันกับ r ดังนั้นยิ่งเข้าใกล้ศูนย์กลาง (r เล็ก) ความเร็วยิ่งสูง (จนถึงแกนกลางที่เป็นจุดเอกฐาน ต้องจำกัดค่าไว้)",
  },
  {
    question: "'สนามความเร็ว' (velocity field) บอกอะไรกับเรา?",
    choices: [
      "ความดันที่ทุกจุด",
      "ความเร็วและทิศทางของของไหลที่ทุกจุดในปริภูมิ",
      "อุณหภูมิของของไหล",
      "มวลของของไหล",
    ],
    answer: 1,
    explain: "สนามความเร็วกำหนดเวกเตอร์ความเร็ว (ขนาด + ทิศทาง) ที่ทุกตำแหน่ง (x, y) เราจึงวาดเป็นลูกศร เส้นการไหล และอนุภาคที่ไหลตามสนามได้",
  },
];

export default function VelocityFieldSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [field, setField] = useState<FieldKind>("source");
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FieldParticle[]>(seedParticles(PARTICLE_COUNT, WORLD_HALF));

  // Derived physics for the result panel.
  const fieldParams: FieldParams = { strength: params.strength, secondary: params.secondary };
  const vmax = maxSpeed(field, fieldParams);
  const singulars = singularCount(field);
  const kindIndex = FIELD_ORDER.indexOf(field);

  // Keep the latest field/params available to the per-frame draw closure
  // without restarting the RAF loop.
  const liveRef = useRef({ field, fieldParams });
  liveRef.current = { field, fieldParams };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT, WORLD_HALF);
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
      ...(typeof vals.secondary === "number" ? { secondary: vals.secondary } : {}),
    }));
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

    // Normalisation reference for colours / vector lengths.
    const refSpeed = Math.max(maxSpeed(fk, fp), 0.4);

    // --- background panel ---
    ctx.fillStyle = dark ? "rgba(6,30,55,0.25)" : "rgba(207,250,254,0.35)";
    ctx.fillRect(0, 0, width, height);

    // --- streamlines: integrate the field forward from a seed grid ---
    if (controls.toggles.streamlines) {
      const seeds = 8;
      for (let a = 0; a < seeds; a++) {
        for (let b = 0; b < seeds; b++) {
          if ((a + b) % 2 !== 0) continue; // sparse lattice to keep it light
          let x = -WORLD_HALF + (a / (seeds - 1)) * 2 * WORLD_HALF;
          let y = -WORLD_HALF + (b / (seeds - 1)) * 2 * WORLD_HALF;
          const pts: Pt[] = [{ x: toX(x), y: toY(y) }];
          for (let s = 0; s < 40; s++) {
            const v = velocityAt(x, y, fk, fp);
            if (v.speed < 1e-4) break;
            const step = 0.16;
            x += (v.vx / v.speed) * step;
            y += (v.vy / v.speed) * step;
            if (Math.abs(x) > WORLD_HALF * 1.25 || Math.abs(y) > WORLD_HALF * 1.25) break;
            pts.push({ x: toX(x), y: toY(y) });
          }
          drawStreamline(
            ctx,
            pts,
            dark ? "rgba(103,232,249,0.28)" : "rgba(8,145,178,0.28)",
            1.1,
          );
        }
      }
    }

    // --- advected particles: move along the field, recycle off-box ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const v = velocityAt(p.x, p.y, fk, fp);
      // advect (dt = 0 when paused → holds still). World units per second.
      p.x += (v.vx * FIELD_SPEED * dt) / pxPerWorld;
      p.y += (v.vy * FIELD_SPEED * dt) / pxPerWorld;
      recycleParticle(p, WORLD_HALF, fk);

      if (!controls.toggles.particles) continue;
      const sp = clamp(v.speed / refSpeed, 0, 1);
      // screen-space travel direction (robust to any world→canvas mapping)
      const eps = 0.01;
      let ux = toX(p.x + v.vx * eps) - toX(p.x);
      let uy = toY(p.y + v.vy * eps) - toY(p.y);
      const mm = Math.hypot(ux, uy) || 1;
      ux /= mm;
      uy /= mm;
      const trail = clamp(sp * 16, 0, 18);
      drawFlowParticle(ctx, toX(p.x), toY(p.y), ux, uy, velocityRampRGB(sp), {
        radius: 2.2 + sp * 0.8,
        trail,
        alpha: 0.85,
        glow: sp > 0.6,
      });
    }

    // --- velocity vectors: sparse grid, LENGTH ∝ local speed ---
    if (controls.toggles.vectors) {
      const gx = 9;
      const gy = 7;
      for (let i = 0; i < gx; i++) {
        for (let j = 0; j < gy; j++) {
          const x = -WORLD_HALF + ((i + 0.5) / gx) * 2 * WORLD_HALF;
          const y = -WORLD_HALF + ((j + 0.5) / gy) * 2 * WORLD_HALF;
          const v = velocityAt(x, y, fk, fp);
          if (v.speed < 1e-4) continue;
          // Length grows with speed (longer where faster), clamped on-screen.
          const len = clamp((v.speed / refSpeed) * 22, 4, 30);
          const inv = len / v.speed;
          drawArrow(
            ctx,
            toX(x),
            toY(y),
            toX(x) + v.vx * inv,
            toY(y) - v.vy * inv, // screen y inverted
            "#f59e0b",
            1.5,
            5,
          );
        }
      }
    }

    // --- singular-point marker ---
    if (hasSingularity(fk)) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      drawLabel(ctx, "จุดเอกฐาน (singularity)", cx, cy - 16, {
        align: "center",
        color: dark ? "#fecaca" : "#7f1d1d",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- field label ---
    drawLabel(ctx, fieldLabel(fk), cx, 18, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation =
    field === "source"
      ? `สนาม '${fieldLabel(field)}' — ของไหลพุ่ง 'ออก' จากศูนย์กลางทุกทิศทาง (v_r = m/2πr) ความเร็วสูงสุดใกล้แกนกลางและลดลงเมื่ออยู่ไกลออกไป ลูกศรยิ่งยาว = ของไหลยิ่งเร็ว`
      : field === "sink"
        ? `สนาม '${fieldLabel(field)}' — ของไหลถูก 'ดูด' เข้าหาศูนย์กลาง (ตรงข้ามกับ source) ความเร็วยิ่งสูงเมื่อเข้าใกล้แกนกลาง ลูกศรยิ่งยาวตรงที่ของไหลเร็วที่สุด`
        : field === "vortex"
          ? `สนาม '${fieldLabel(field)}' — ของไหล 'หมุนวน' รอบศูนย์กลาง (v_θ = Γ/2πr) ความเร็วสูงสุดใกล้แกนกลางและลดลงตาม 1/r ลูกศรยิ่งยาวตรงที่หมุนเร็วที่สุด`
          : field === "combined"
            ? `สนาม '${fieldLabel(field)}' — รวม source กับกระแสสม่ำเสมอ (uniform) เกิดเป็น Rankine half-body ของไหลจากแหล่งกำเนิดถูกพัดไปตามกระแส ลูกศรยิ่งยาว = ของไหลยิ่งเร็ว`
            : `สนาม '${fieldLabel(field)}' — ความเร็วเท่ากันทุกจุด u = (U, 0) ลูกศรทุกตัวยาวเท่ากันและชี้ไปทางเดียว ไม่มีจุดเอกฐาน นี่คือสนามความเร็วที่ง่ายที่สุด`;

  const strengthSymbol =
    field === "vortex" ? "Γ" : field === "uniform" ? "U" : "m";
  const strengthUnit =
    field === "vortex" ? "m²/s" : "m/s";

  const availableToggles = ["particles", "streamlines", "vectors", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            kind: kindIndex,
            strength: params.strength,
            secondary: params.secondary,
            vmax,
            singulars,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ชนิดสนามความเร็ว"
          value={fieldLabel(field)}
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label={`ความแรงสนาม ${strengthSymbol}`} value={params.strength} unit={strengthUnit} />
        <ResultStat label="ความเร็วสูงสุด (จำกัดค่า)" value={vmax} unit="m/s" />
        <ResultStat label="จำนวนจุดเอกฐาน" value={singulars} unit="จุด" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: hasSingularity(field) ? "เร็วสูงสุดใกล้แกนกลาง" : "ความเร็วคงที่ทุกจุด",
          tone: "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={fieldFormula(field)}
          substituted={
            field === "vortex"
              ? `Γ = ${formatNumber(params.strength)} m²/s → ความเร็วสูงสุด (จำกัดค่า) ≈ ${formatNumber(vmax)} m/s`
              : field === "uniform"
                ? `U = ${formatNumber(params.strength)} m/s → ความเร็วคงที่ทุกจุด`
                : field === "combined"
                  ? `m = ${formatNumber(params.strength)} m/s, U = ${formatNumber(params.secondary)} m/s → ความเร็วสูงสุด (จำกัดค่า) ≈ ${formatNumber(vmax)} m/s`
                  : `m = ${formatNumber(params.strength)} m/s → ความเร็วสูงสุด (จำกัดค่า) ≈ ${formatNumber(vmax)} m/s`
          }
          variables={[
            { symbol: "v_r", meaning: "ความเร็วเชิงรัศมี Radial speed", unit: "m/s" },
            { symbol: "v_θ", meaning: "ความเร็วเชิงมุม Tangential speed", unit: "m/s" },
            { symbol: "m", meaning: "ความแรง source/sink (strength)", unit: "m²/s" },
            { symbol: "Γ", meaning: "ความเข้มวอร์เท็กซ์ (circulation)", unit: "m²/s" },
            { symbol: "U", meaning: "ความเร็วกระแสอิสระ Free-stream", unit: "m/s" },
            { symbol: "r", meaning: "ระยะจากศูนย์กลาง Radius", unit: "m" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            source ดันออก · sink ดูดเข้า · vortex หมุนวน · uniform คงที่ — ความเร็วของ source/sink/vortex ลดลงตาม 1/r และต้อง 'จำกัดค่า' ใกล้จุดเอกฐานเพื่อไม่ให้ลูกศร/อนุภาคพุ่งออกนอกจอ
          </p>
        </FormulaCard>
      )}

      <div className="rounded-xl border border-line bg-surface-soft p-3 text-[11px] leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">คำอธิบายภาพ:</span> 🟧 ลูกศร = เวกเตอร์ความเร็ว (ยิ่งยาว = ยิ่งเร็ว) · เส้นจาง = เส้นการไหล (streamlines) · จุดสี = อนุภาคที่ไหลตามสนาม (สว่าง = เร็ว) · 🔴 = จุดเอกฐาน
      </div>
    </>
  );

  return (
    <SimulationLayout
      title="สนามความเร็ว"
      titleEn="Velocity Field Explorer"
      icon="🧮"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">ชนิดสนามความเร็ว Field</span>
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
            label={
              field === "vortex"
                ? "ความเข้มวอร์เท็กซ์ (Γ)"
                : field === "uniform"
                  ? "ความเร็วกระแส (U)"
                  : "ความแรงสนาม (m)"
            }
            symbol={strengthSymbol}
            value={params.strength}
            min={0.5}
            max={8}
            step={0.1}
            unit={strengthUnit}
            decimals={1}
            onChange={set("strength")}
          />
          {field === "combined" && (
            <ControlSlider
              label="ความแรงกระแสรอง (U)"
              symbol="U"
              value={params.secondary}
              min={0.2}
              max={4}
              step={0.1}
              unit="m/s"
              decimals={1}
              onChange={set("secondary")}
            />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-velfield">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="สนามความเร็ว 2 มิติ แสดงลูกศรเวกเตอร์ความเร็ว เส้นการไหล และอนุภาคที่ไหลตามสนาม source/sink/vortex/uniform"
          />
        </SimStage>
      }
      results={<div id="explain-velfield">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
