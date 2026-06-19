import { useMemo, useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { Button } from "../ui/Button";
import { LineChart, type Point } from "../charts/LineChart";
import { calculateHeadLoss, headToPressure } from "../../utils/physics";
import { RHO_WATER } from "../../constants/physics";

const MAX_V = 10;

// Typical minor-loss coefficients (K) for quick-add.
const FITTINGS = [
  { label: "ข้องอ 90° (elbow)", k: 0.9 },
  { label: "วาล์วประตู เปิดสุด (gate valve)", k: 0.2 },
  { label: "วาล์วโกลบ (globe valve)", k: 10 },
  { label: "ทางเข้าท่อ (entrance)", k: 0.5 },
  { label: "ทางออกท่อ (exit)", k: 1.0 },
];

/**
 * F. Pipe Loss Calculator — Darcy–Weisbach + minor losses.
 * Shows how head loss grows with the square of velocity.
 */
export function PipeLossSim() {
  const [length, setLength] = useState(50);
  const [diameter, setDiameter] = useState(0.1);
  const [velocity, setVelocity] = useState(2);
  const [friction, setFriction] = useState(0.02);
  const [k, setK] = useState(1.4);

  const loss = calculateHeadLoss(friction, length, diameter, velocity, k);
  const pressureDrop = headToPressure(loss.totalLoss, RHO_WATER);

  // Head loss vs velocity (quadratic) for the current geometry.
  const curve = useMemo<Point[]>(() => {
    const pts: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const v = (MAX_V * i) / 20;
      pts.push({
        x: v,
        y: calculateHeadLoss(friction, length, diameter, v, k).totalLoss,
      });
    }
    return pts;
  }, [friction, length, diameter, k]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <FormulaBox
          expression="h_f = f(L/D)·V²/2g    +    h_m = K·V²/2g"
          caption="การสูญเสียเฮดรวม = major + minor (หน่วยเป็นเมตร)"
        />

        <SliderInput
          label="ความยาวท่อ"
          symbol="L"
          value={length}
          onChange={setLength}
          min={1}
          max={500}
          step={1}
          unit="m"
        />
        <SliderInput
          label="เส้นผ่านศูนย์กลาง"
          symbol="D"
          value={diameter}
          onChange={setDiameter}
          min={0.01}
          max={1}
          step={0.01}
          unit="m"
          warning={diameter <= 0 ? "เส้นผ่านศูนย์กลางต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความเร็ว"
          symbol="V"
          value={velocity}
          onChange={setVelocity}
          min={0}
          max={MAX_V}
          step={0.1}
          unit="m/s"
        />
        <SliderInput
          label="ตัวประกอบความเสียดทาน"
          symbol="f"
          labelEn="Friction factor"
          value={friction}
          onChange={setFriction}
          min={0.005}
          max={0.1}
          step={0.001}
          unit="—"
        />
        <SliderInput
          label="ค่าสัมประสิทธิ์ minor loss (รวม)"
          symbol="K"
          value={k}
          onChange={setK}
          min={0}
          max={30}
          step={0.1}
          unit="—"
        />

        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            เพิ่ม fitting (บวกค่า K):
          </div>
          <div className="flex flex-wrap gap-2">
            {FITTINGS.map((f) => (
              <Button
                key={f.label}
                size="sm"
                variant="outline"
                onClick={() => setK((prev) => Math.min(30, +(prev + f.k).toFixed(2)))}
              >
                + {f.label} (K={f.k})
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setK(0)}>
              ล้าง K
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ResultDisplay label="Major loss h_f" value={loss.majorLoss} unit="m" tone="brand" />
          <ResultDisplay label="Minor loss h_m" value={loss.minorLoss} unit="m" tone="aqua" />
          <ResultDisplay
            label="รวม (Total)"
            value={loss.totalLoss}
            unit="m"
            tone="amber"
            size="lg"
          />
        </div>
        <ResultDisplay
          label="≈ ความดันที่หายไป (Δp)"
          value={pressureDrop / 1000}
          unit="kPa"
          tone="red"
          hint="แปลงเฮดเป็นความดันด้วย Δp = ρ·g·h (น้ำ)"
        />

        <Callout kind="info" title="ทำไมจึงเสียพลังงานมากขึ้น?">
          <ul className="ml-4 list-disc space-y-1">
            <li>ท่อ <strong>ยาวขึ้น</strong> (L↑): เสียดทานสะสมมากขึ้น → h_f เพิ่มเชิงเส้น</li>
            <li>ท่อ <strong>เล็กลง</strong> (D↓): h_f ∝ 1/D เพิ่มเร็ว และยังทำให้ V สูงขึ้นด้วย</li>
            <li>ความเร็ว <strong>สูงขึ้น</strong> (V↑): h_f, h_m ∝ V² เพิ่มแบบกำลังสอง</li>
          </ul>
        </Callout>
      </div>

      {/* ---- Visualization ---- */}
      <div className="space-y-4">
        <div className="surface p-4">
          <PipeSchematic velocity={velocity} kHasFittings={k > 0} />
        </div>
        <div className="surface p-4">
          <div className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Head loss เพิ่มแบบกำลังสองตามความเร็ว
          </div>
          <LineChart
            data={curve}
            marker={{ x: velocity, y: loss.totalLoss }}
            xLabel="ความเร็ว V (m/s)"
            yLabel="Head loss (m)"
            color="#f59e0b"
          />
        </div>
      </div>
    </div>
  );
}

/** A horizontal pipe with an elbow and a valve, plus animated flow dashes. */
function PipeSchematic({ velocity, kHasFittings }: { velocity: number; kHasFittings: boolean }) {
  const W = 360;
  const H = 170;
  const pipeY = 70;
  const dashSpeed = Math.max(0.3, Math.min(3, velocity / 2));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* main pipe */}
      <rect x="10" y={pipeY - 14} width="250" height="28" rx="4" className="fill-slate-200 dark:fill-slate-700" />
      {/* elbow down */}
      <rect x="246" y={pipeY - 14} width="28" height="90" rx="4" className="fill-slate-200 dark:fill-slate-700" />
      <rect x="246" y={pipeY + 48} width="110" height="28" rx="4" className="fill-slate-200 dark:fill-slate-700" />

      {/* animated flow centerline */}
      <line
        x1="14"
        y1={pipeY}
        x2="256"
        y2={pipeY}
        stroke="#3a98f5"
        strokeWidth="3"
        strokeDasharray="14 10"
        className="animate-flow-dash"
        style={{ animationDuration: `${1.4 / dashSpeed}s` }}
      />
      <line
        x1="260"
        y1={pipeY + 62}
        x2="352"
        y2={pipeY + 62}
        stroke="#3a98f5"
        strokeWidth="3"
        strokeDasharray="14 10"
        className="animate-flow-dash"
        style={{ animationDuration: `${1.4 / dashSpeed}s` }}
      />

      {/* valve symbol on the main run */}
      <g transform={`translate(130, ${pipeY})`}>
        <polygon points="-12,-12 0,0 -12,12" className="fill-rose-500" />
        <polygon points="12,-12 0,0 12,12" className="fill-rose-500" />
        <rect x="-3" y="-26" width="6" height="14" className="fill-slate-500" />
        <text x="0" y="-30" textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold">
          วาล์ว
        </text>
      </g>

      {/* elbow label */}
      <text x="290" y={pipeY + 30} className="fill-slate-500 text-[9px] font-semibold">
        ข้องอ 90°
      </text>

      {kHasFittings && (
        <text x="14" y={H - 8} className="fill-amber-600 text-[10px] font-medium">
          ⚠️ fitting แต่ละชิ้นเพิ่ม minor loss (K)
        </text>
      )}
    </svg>
  );
}
