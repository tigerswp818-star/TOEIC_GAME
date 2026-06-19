import { useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { FLUID_PRESETS, GRAVITY, RHO_WATER } from "../../constants/physics";
import { calculateDensity, calculateSpecificWeight } from "../../utils/physics";
import { formatNumber } from "../../utils/format";

/**
 * Chapter 1 interactive: density ρ = m/V and specific weight γ = ρg, with a
 * visual comparison against common fluids so the number means something.
 */
export function FluidPropertiesSim() {
  const [mass, setMass] = useState(2);
  const [volumeL, setVolumeL] = useState(2); // litres

  const volume = volumeL / 1000;
  const density = calculateDensity(mass, volume);
  const specificWeight = calculateSpecificWeight(density, GRAVITY);
  // relative density (specific gravity) vs water
  const sg = density / RHO_WATER;

  // Scale for the comparison bars (cap at mercury-ish).
  const maxRho = 14000;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <FormulaBox expression="ρ = m / V        γ = ρ · g" caption="ความหนาแน่น (kg/m³) และน้ำหนักจำเพาะ (N/m³)" />
        <SliderInput
          label="มวล"
          symbol="m"
          labelEn="Mass"
          value={mass}
          onChange={setMass}
          min={0.01}
          max={50}
          step={0.01}
          unit="kg"
        />
        <SliderInput
          label="ปริมาตร"
          symbol="V"
          labelEn="Volume"
          value={volumeL}
          onChange={setVolumeL}
          min={0.01}
          max={50}
          step={0.01}
          unit="L"
          warning={volumeL <= 0 ? "ปริมาตรต้องมากกว่า 0" : null}
        />

        <div className="grid grid-cols-2 gap-3">
          <ResultDisplay label="ความหนาแน่น ρ" value={density} unit="kg/m³" tone="brand" size="lg" />
          <ResultDisplay label="น้ำหนักจำเพาะ γ" value={specificWeight} unit="N/m³" tone="aqua" />
        </div>
        <ResultDisplay
          label="ความถ่วงจำเพาะ (Specific gravity, เทียบน้ำ)"
          value={sg}
          unit="×"
          tone={sg < 1 ? "green" : "amber"}
          hint={sg < 1 ? "เบากว่าน้ำ → มีแนวโน้มลอย" : "หนักกว่าน้ำ → มีแนวโน้มจม"}
        />

        <Callout kind="info" title="แนวคิดสำคัญ">
          ความหนาแน่นบอกว่ามวลอัดแน่นแค่ไหนต่อปริมาตร ส่วนน้ำหนักจำเพาะคือ
          น้ำหนัก (แรง) ต่อปริมาตร ทั้งสองต่างกันที่ตัวคูณ g
        </Callout>
      </div>

      {/* comparison chart */}
      <div className="surface p-4">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          เทียบกับของไหลทั่วไป (Density comparison)
        </div>
        <div className="space-y-2">
          {/* the current sample */}
          <ComparisonRow name="ตัวอย่างของคุณ" value={density} max={maxRho} highlight />
          {FLUID_PRESETS.filter((f) => f.id !== "air").map((f) => (
            <ComparisonRow key={f.id} name={`${f.name} (${f.nameEn})`} value={f.density} max={maxRho} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({
  name,
  value,
  max,
  highlight = false,
}: {
  name: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className={highlight ? "font-bold text-brand-600 dark:text-brand-300" : "text-slate-500 dark:text-slate-400"}>
          {name}
        </span>
        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
          {formatNumber(value, 4)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${highlight ? "bg-gradient-to-r from-brand-500 to-aqua-400" : "bg-slate-300 dark:bg-slate-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
