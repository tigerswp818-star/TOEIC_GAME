import { useEffect, useState } from "react";
import type { Challenge } from "@/types/simulation";
import { useProgress } from "@/hooks/useProgress";

interface ChallengePanelProps {
  challenges: Challenge[];
  /** Live result object the challenge predicates run against. */
  result: Record<string, number>;
}

/** Presents a goal and gives instant feedback when the learner achieves it. */
export default function ChallengePanel({ challenges, result }: ChallengePanelProps) {
  const [i, setI] = useState(0);
  const [celebrated, setCelebrated] = useState(false);
  const { markChallengeSolved } = useProgress();
  const challenge = challenges[i];
  const solved = challenge ? challenge.isSolved(result) : false;

  useEffect(() => {
    if (solved && challenge) {
      setCelebrated(true);
      markChallengeSolved(challenge.title);
    }
  }, [solved, challenge, markChallengeSolved]);

  // Reset celebration when switching challenges.
  useEffect(() => setCelebrated(false), [i]);

  if (!challenge) return null;

  return (
    <section
      className={`rounded-xl border p-3.5 transition ${
        solved
          ? "border-emerald-400 bg-emerald-500/10"
          : "border-amber-400/40 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <span aria-hidden>🎯</span> โจทย์ท้าทาย
        </span>
        <span className="text-xs text-ink-faint">
          {i + 1} / {challenges.length}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{challenge.title}</p>
      <p className="mt-1 text-xs text-ink-soft">💬 {challenge.hint}</p>

      <div
        className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          solved
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-surface-soft text-ink-faint"
        }`}
        aria-live="polite"
      >
        {solved ? `✅ ${challenge.success}` : "⏳ ปรับค่าให้ถึงเป้าหมาย…"}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="lab-btn-ghost !py-1.5 !text-xs"
        >
          ← โจทย์ก่อน
        </button>
        <button
          type="button"
          onClick={() => setI((v) => (v + 1) % challenges.length)}
          className="lab-btn-ghost !py-1.5 !text-xs"
        >
          โจทย์ถัดไป →
        </button>
      </div>

      {celebrated && solved && (
        <p className="mt-2 animate-fade-in text-center text-xs font-semibold text-emerald-600 dark:text-emerald-300">
          🎉 เยี่ยมมาก! ทำสำเร็จแล้ว
        </p>
      )}
    </section>
  );
}
