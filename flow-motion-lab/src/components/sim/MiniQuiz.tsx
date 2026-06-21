import { useState } from "react";
import type { QuizItem } from "@/types/simulation";
import { useProgress } from "@/hooks/useProgress";

interface MiniQuizProps {
  items: QuizItem[];
}

/** A short multiple-choice quiz with instant, explained feedback. */
export default function MiniQuiz({ items }: MiniQuizProps) {
  const { recordQuiz } = useProgress();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = items[idx];
  if (!item) return null;

  const answered = picked !== null;
  const correct = picked === item.answer;

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    recordQuiz(i === item.answer);
  };

  const next = () => {
    setPicked(null);
    setIdx((v) => (v + 1) % items.length);
  };

  return (
    <div className="lab-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-flow-400 to-iris-500 text-xs shadow-glow">❓</span>
          Mini Quiz
        </h3>
        <span className="text-xs text-ink-faint">
          ข้อ {idx + 1} / {items.length}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-ink">{item.question}</p>

      <div className="mt-3 grid gap-2">
        {item.choices.map((c, i) => {
          const isAnswer = i === item.answer;
          const isPicked = i === picked;
          let tone =
            "border-line bg-surface-soft text-ink-soft hover:border-flow-400 hover:text-ink";
          if (answered && isAnswer)
            tone = "border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
          else if (answered && isPicked && !isAnswer)
            tone = "border-rose-400 bg-rose-500/10 text-rose-700 dark:text-rose-300";
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => choose(i)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${tone}`}
            >
              <span className="mr-2 font-mono text-xs text-ink-faint">
                {String.fromCharCode(65 + i)}
              </span>
              {c}
              {answered && isAnswer && <span className="ml-2">✅</span>}
              {answered && isPicked && !isAnswer && <span className="ml-2">❌</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 animate-fade-in rounded-xl bg-surface-soft p-3 text-sm">
          <p className={`font-semibold ${correct ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
            {correct ? "ถูกต้อง! 🎉" : "ยังไม่ใช่ ลองดูเฉลย"}
          </p>
          <p className="mt-1 leading-relaxed text-ink-soft">{item.explain}</p>
          <button type="button" onClick={next} className="lab-btn-primary mt-3 !py-1.5 !text-xs">
            ข้อถัดไป →
          </button>
        </div>
      )}
    </div>
  );
}
