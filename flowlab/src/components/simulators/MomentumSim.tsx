import { useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { circleArea } from "../../utils/physics";
import { RHO_WATER } from "../../constants/physics";
import { formatNumber } from "../../utils/format";

/**
 * Chapter 8 interactive: momentum equation for a jet striking a flat plate.
 * For a jet hitting a stationary normal plate the fluid's x-momentum goes to
 * zero, so the force on the plate is
 *   F = ṁ·V = (ρ·A·V)·V = ρ·A·V²   [N]
 * (a special case of F = ṁ(V_out − V_in)).
 */
export function MomentumSim() {
  const [velocity, setVelocity] = useState(8);
  const [diameter, setDiameter] = useState(0.02); // jet diameter, m
  const [density, setDensity] = useState(RHO_WATER);

  const area = circleArea(diameter);
  const massFlow = density * area * velocity; // ṁ = ρ A V
  const force = massFlow * velocity; // F = ṁ V = ρ A V²

  const arrowLen = Math.max(10, Math.min(70, force / 30));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <FormulaBox
          expression="F = ṁ·V = ρ·A·V²"
          caption="เจ็ตน้ำพุ่งชนแผ่นตั้งฉาก (ṁ = ρ·A·V)"
        />
        <SliderInput
          label="ความเร็วเจ็ต"
          symbol="V"
          value={velocity}
          onChange={setVelocity}
          min={1}
          max={40}
          step={0.5}
          unit="m/s"
        />
        <SliderInput
          label="เส้นผ่านศูนย์กลางเจ็ต"
          symbol="D"
          value={diameter}
          onChange={setDiameter}
          min={0.005}
          max={0.1}
          step={0.001}
          unit="m"
          warning={diameter <= 0 ? "เส้นผ่านศูนย์กลางต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความหนาแน่น"
          symbol="ρ"
          value={density}
          onChange={setDensity}
          min={100}
          max={2000}
          step={10}
          unit="kg/m³"
        />

        <div className="grid grid-cols-2 gap-3">
          <ResultDisplay label="อัตราการไหลมวล ṁ" value={massFlow} unit="kg/s" tone="aqua" />
          <ResultDisplay label="แรงที่กระทำต่อแผ่น F" value={force} unit="N" tone="brand" size="lg" />
        </div>

        <Callout kind="info" title="แนวคิดสำคัญ">
          แรงเกิดจากการที่ของไหล <strong>เปลี่ยนโมเมนตัม</strong> สังเกตว่า F ∝ V²
          ความเร็วเพิ่ม 2 เท่า แรงเพิ่ม 4 เท่า — หลักการเดียวกับที่ใช้ออกแบบกังหันน้ำ
          และคำนวณแรงดันน้ำบนใบพัด
        </Callout>
        <Callout kind="assumption">
          สมมติว่าเจ็ตชนแผ่นตั้งฉากแล้วไหลออกด้านข้าง (โมเมนตัมแนว x เหลือศูนย์),
          steady flow และไม่คิดแรงเสียดทาน/แรงโน้มถ่วงในช่วงสั้น ๆ
        </Callout>
      </div>

      <div className="surface p-4">
        <svg viewBox="0 0 320 220" className="w-full">
          {/* nozzle */}
          <rect x="10" y="92" width="40" height="36" rx="4" className="fill-slate-400 dark:fill-slate-600" />
          {/* jet */}
          <rect
            x="50"
            y={110 - Math.max(4, diameter * 300)}
            width="170"
            height={Math.max(8, diameter * 600)}
            className="fill-aqua-400/70"
          />
          {/* animated jet dashes */}
          <line
            x1="55"
            y1="110"
            x2="215"
            y2="110"
            stroke="#1d62d7"
            strokeWidth="3"
            strokeDasharray="16 10"
            className="animate-flow-dash"
            style={{ animationDuration: `${Math.max(0.4, 3 / velocity)}s` }}
          />
          {/* plate */}
          <rect x="224" y="40" width="14" height="140" rx="4" className="fill-slate-500 dark:fill-slate-400" />
          {/* splash */}
          <path d="M224 110 q -6 -30 -22 -44" fill="none" stroke="#34c7c7" strokeWidth="2" opacity="0.6" />
          <path d="M224 110 q -6 30 -22 44" fill="none" stroke="#34c7c7" strokeWidth="2" opacity="0.6" />

          {/* force arrow on plate */}
          <line x1="238" y1="110" x2={238 + arrowLen} y2="110" stroke="#2479ea" strokeWidth="4" />
          <polygon
            points={`${238 + arrowLen + 9},110 ${238 + arrowLen},105 ${238 + arrowLen},115`}
            fill="#2479ea"
          />
          <text x="248" y="92" className="fill-brand-600 text-[11px] font-bold">
            F = {formatNumber(force, 3)} N
          </text>
        </svg>
        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          เจ็ตน้ำพุ่งชนแผ่น → เกิดแรงผลักแผ่น (ลูกศรน้ำเงิน)
        </p>
      </div>
    </div>
  );
}
