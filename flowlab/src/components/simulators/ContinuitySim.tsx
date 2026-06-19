import { useEffect, useMemo, useRef, useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { calculateContinuityVelocity, calculateFlowRate } from "../../utils/physics";
import { formatNumber } from "../../utils/format";

const W = 360;
const H = 200;
const CY = 100;
const MAX_AREA = 500; // cm² for visual scaling
const MAX_HALF = 62;
const MIN_HALF = 9;

// Local pipe area (cm²) as a function of x: flat → taper → flat.
function localArea(x: number, a1: number, a2: number): number {
  if (x < 130) return a1;
  if (x > 210) return a2;
  const t = (x - 130) / 80;
  return a1 + (a2 - a1) * t;
}

function halfHeight(areaCm2: number): number {
  return Math.max(MIN_HALF, Math.min(MAX_HALF, (areaCm2 / MAX_AREA) * MAX_HALF));
}

interface Particle {
  x: number;
  /** normalized vertical position within the pipe, -1..1 */
  ny: number;
}

/**
 * C. Continuity Equation Simulator — A₁V₁ = A₂V₂.
 * Particles speed up as the pipe narrows; velocity vectors and the flow rate
 * update live.
 */
export function ContinuitySim() {
  const [area1, setArea1] = useState(300); // cm²
  const [area2, setArea2] = useState(100); // cm²
  const [velocity1, setVelocity1] = useState(2); // m/s

  // m² for the physics.
  const a1m = area1 / 10000;
  const a2m = area2 / 10000;
  const Q = calculateFlowRate(a1m, velocity1);
  const v2 = calculateContinuityVelocity(a1m, velocity1, a2m);

  const half1 = halfHeight(area1);
  const half2 = halfHeight(area2);

  // ---- particle animation ----
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: 26 }, () => ({
      x: Math.random() * W,
      ny: (Math.random() * 2 - 1) * 0.8,
    })),
  );
  const [, setTick] = useState(0);
  const rafRef = useRef<number>();
  // Keep the latest inputs in refs so the rAF loop reads fresh values.
  const stateRef = useRef({ area1, area2, velocity1 });
  stateRef.current = { area1, area2, velocity1 };

  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, now - last); // cap dt after tab switches
      last = now;
      const { area1: a1, area2: a2, velocity1: v1 } = stateRef.current;
      const q = (a1 / 10000) * v1; // m³/s
      for (const p of particlesRef.current) {
        const aLoc = localArea(p.x, a1, a2); // cm²
        const aLocM = aLoc / 10000;
        const vLoc = aLocM > 0 ? q / aLocM : 0; // m/s
        // px/ms speed scaled for a pleasant pace
        p.x += vLoc * dt * 0.05;
        if (p.x > W) {
          p.x -= W;
          p.ny = (Math.random() * 2 - 1) * 0.85;
        }
      }
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Pipe outline path (top then bottom).
  const pipePath = useMemo(() => {
    const top = (x: number) => CY - halfHeight(localArea(x, area1, area2));
    const bot = (x: number) => CY + halfHeight(localArea(x, area1, area2));
    const xs = [0, 130, 210, W];
    let d = `M 0 ${top(0)}`;
    for (const x of xs) d += ` L ${x} ${top(x)}`;
    for (const x of [...xs].reverse()) d += ` L ${x} ${bot(x)}`;
    return d + " Z";
  }, [area1, area2]);

  const arrowLen = (v: number) => Math.max(8, Math.min(46, v * 9));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <FormulaBox
          expression="Q = A·V    →    A₁V₁ = A₂V₂"
          caption="ของไหลอัดตัวไม่ได้ (incompressible), การไหลคงตัว (steady)"
        />

        <SliderInput
          label="พื้นที่หน้าตัด 1"
          symbol="A₁"
          value={area1}
          onChange={setArea1}
          min={20}
          max={MAX_AREA}
          step={5}
          unit="cm²"
        />
        <SliderInput
          label="พื้นที่หน้าตัด 2"
          symbol="A₂"
          value={area2}
          onChange={setArea2}
          min={10}
          max={MAX_AREA}
          step={5}
          unit="cm²"
          warning={area2 <= 0 ? "พื้นที่ต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความเร็วที่ 1"
          symbol="V₁"
          value={velocity1}
          onChange={setVelocity1}
          min={0.1}
          max={10}
          step={0.1}
          unit="m/s"
        />

        <div className="grid grid-cols-2 gap-3">
          <ResultDisplay
            label="อัตราการไหล Q"
            value={Q * 1000}
            unit="L/s"
            tone="brand"
            hint={`= ${formatNumber(Q, 4)} m³/s`}
          />
          <ResultDisplay
            label="ความเร็วที่ 2 (V₂)"
            value={v2}
            unit="m/s"
            tone="aqua"
            size="lg"
          />
        </div>

        <Callout kind="info" title="เกิดอะไรขึ้น?">
          เมื่อท่อแคบลง (A₂ &lt; A₁) ของไหลต้องไหล <strong>เร็วขึ้น</strong>{" "}
          เพื่อรักษาอัตราการไหล Q ให้คงที่ สังเกตว่าอนุภาคในส่วนแคบเคลื่อนที่เร็วกว่า
          และลูกศรความเร็วยาวขึ้น
        </Callout>
      </div>

      {/* ---- Visualization ---- */}
      <div className="surface p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="pipeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfe3ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3a98f5" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* pipe body */}
          <path
            d={pipePath}
            fill="url(#pipeFill)"
            className="stroke-brand-400 dark:stroke-brand-600"
            strokeWidth="2.5"
          />

          {/* particles */}
          {particlesRef.current.map((p, i) => {
            const hh = halfHeight(localArea(p.x, area1, area2));
            const y = CY + p.ny * (hh - 4);
            return (
              <circle key={i} cx={p.x} cy={y} r="2.6" className="fill-brand-700 dark:fill-aqua-300" />
            );
          })}

          {/* velocity vectors */}
          <g>
            <line x1={50} y1={CY} x2={50 + arrowLen(velocity1)} y2={CY} stroke="#1d62d7" strokeWidth="3" />
            <polygon
              points={`${50 + arrowLen(velocity1) + 7},${CY} ${50 + arrowLen(velocity1)},${CY - 4} ${50 + arrowLen(velocity1)},${CY + 4}`}
              fill="#1d62d7"
            />
            <text x={50} y={CY - half1 - 6} className="fill-brand-600 text-[10px] font-bold">
              V₁ = {formatNumber(velocity1, 2)} m/s
            </text>

            <line x1={278} y1={CY} x2={278 + arrowLen(v2)} y2={CY} stroke="#11888c" strokeWidth="3" />
            <polygon
              points={`${278 + arrowLen(v2) + 7},${CY} ${278 + arrowLen(v2)},${CY - 4} ${278 + arrowLen(v2)},${CY + 4}`}
              fill="#11888c"
            />
            <text x={250} y={CY - half2 - 6} className="fill-aqua-600 text-[10px] font-bold">
              V₂ = {formatNumber(v2, 2)} m/s
            </text>
          </g>
        </svg>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          อนุภาคไหลจากซ้าย → ขวา · เร็วขึ้นเมื่อท่อแคบ
        </p>
      </div>
    </div>
  );
}
