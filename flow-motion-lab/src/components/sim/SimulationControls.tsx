import type { SimControls } from "@/hooks/useSimControls";
import type { ToggleKey } from "@/types/simulation";
import ToggleChip from "./ToggleChip";
import { useClassroom } from "@/hooks/useClassroom";

const SPEEDS = [0.25, 0.5, 1, 2];

const TOGGLE_META: Record<ToggleKey, { label: string; icon: string }> = {
  particles: { label: "อนุภาค Particles", icon: "•" },
  streamlines: { label: "เส้นการไหล Streamlines", icon: "〰" },
  vectors: { label: "เวกเตอร์ Velocity", icon: "→" },
  pressure: { label: "สีความดัน Pressure", icon: "🌡" },
  graph: { label: "กราฟ Graph", icon: "📈" },
  formula: { label: "สูตร Formula", icon: "ƒ" },
};

interface SimulationControlsProps {
  controls: SimControls;
  /** Which visualisation layers this simulation exposes. */
  availableToggles: ToggleKey[];
}

/**
 * Playback transport (play / pause / reset / slow-motion / speed) plus the
 * visualisation-layer toggle chips. Shared by every simulation.
 */
export default function SimulationControls({
  controls,
  availableToggles,
}: SimulationControlsProps) {
  const { playing, speed, toggles, togglePlay, setSpeed, reset, setToggle } = controls;
  const { active: classroom } = useClassroom();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="lab-btn-primary !py-2"
          aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
        >
          <span aria-hidden>{playing ? "⏸" : "▶"}</span>
          {playing ? "หยุด Pause" : "เล่น Play"}
        </button>

        <button type="button" onClick={reset} className="lab-btn-ghost !py-2">
          <span aria-hidden>↺</span> รีเซ็ต Reset
        </button>

        <button
          type="button"
          onClick={() => setSpeed(0.25)}
          className={`lab-btn-ghost !py-2 ${speed === 0.25 ? "ring-2 ring-flow-400" : ""}`}
          title="ดูแบบช้า Slow motion"
        >
          <span aria-hidden>🐢</span> ช้า
        </button>

        <div className={`items-center gap-1 rounded-xl border border-line bg-surface-soft p-1 ${classroom ? "hidden" : "flex"}`}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
                speed === s
                  ? "bg-gradient-to-r from-flow-500 to-iris-500 text-white shadow-glow"
                  : "text-ink-soft hover:bg-surface-raised"
              }`}
            >
              ×{s}
            </button>
          ))}
        </div>
      </div>

      {!classroom && (
        <div className="flex flex-wrap gap-2">
          {availableToggles.map((key) => (
            <ToggleChip
              key={key}
              label={TOGGLE_META[key].label}
              icon={TOGGLE_META[key].icon}
              active={toggles[key]}
              onClick={() => setToggle(key, !toggles[key])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
