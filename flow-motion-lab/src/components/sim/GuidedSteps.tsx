import { useEffect, useState } from "react";
import type { GuidedStep } from "@/types/simulation";

interface GuidedStepsProps {
  steps: GuidedStep[];
  /** Called when a step wants to apply preset parameter values. */
  onApply: (values: Record<string, number>) => void;
}

/** Walks the learner through a simulation one step at a time. */
export default function GuidedSteps({ steps, onApply }: GuidedStepsProps) {
  const [i, setI] = useState(0);
  const step = steps[i];

  // Apply this step's preset values whenever the active step changes.
  useEffect(() => {
    if (step?.apply) onApply(step.apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!step) return null;

  return (
    <section className="rounded-xl border border-flow-500/30 bg-flow-500/5 p-3.5">
      <div className="flex items-center justify-between">
        <span className="lab-chip !border-flow-400/40 !bg-flow-500/10 !text-flow-600 dark:!text-flow-300">
          ขั้นที่ {i + 1} / {steps.length}
        </span>
        <div className="flex gap-1.5">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 w-5 rounded-full transition ${idx <= i ? "bg-gradient-to-r from-flow-500 to-iris-500" : "bg-line"}`}
            />
          ))}
        </div>
      </div>
      <h3 className="mt-2.5 text-sm font-bold text-ink">{step.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="lab-btn-ghost !py-1.5 !text-xs"
        >
          ← ก่อนหน้า
        </button>
        {i < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))}
            className="lab-btn-primary !py-1.5 !text-xs"
          >
            ถัดไป →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setI(0)}
            className="lab-btn-ghost !py-1.5 !text-xs"
          >
            ↺ เริ่มใหม่
          </button>
        )}
      </div>
    </section>
  );
}
