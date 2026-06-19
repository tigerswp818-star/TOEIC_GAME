import { useMemo, useState } from "react";
import type { QuizQuestion } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Callout } from "../ui/Callout";
import { ProgressBar } from "../ui/ProgressBar";
import { formatNumber } from "../../utils/format";

interface QuizRunnerProps {
  questions: QuizQuestion[];
  /** Called when the quiz finishes with the final score. */
  onComplete?: (correct: number, total: number) => void;
  /** Compact styling for embedding inside a lesson. */
  compact?: boolean;
}

interface AnswerState {
  answered: boolean;
  correct: boolean;
}

/**
 * Self-contained quiz player supporting multiple-choice, true/false and numeric
 * questions with immediate "why" feedback and a running score.
 */
export function QuizRunner({ questions, onComplete, compact = false }: QuizRunnerProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerState[]>([]);
  const [finished, setFinished] = useState(false);

  // per-question working answer
  const [selected, setSelected] = useState<number | null>(null);
  const [boolPick, setBoolPick] = useState<boolean | null>(null);
  const [numInput, setNumInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);

  const q = questions[index];
  const score = useMemo(() => results.filter((r) => r.correct).length, [results]);

  if (!q) {
    return (
      <Callout kind="info">ยังไม่มีคำถามสำหรับบทนี้</Callout>
    );
  }

  const check = () => {
    let correct = false;
    if (q.type === "mcq") correct = selected === q.answerIndex;
    else if (q.type === "boolean") correct = boolPick === q.answer;
    else if (q.type === "numeric") {
      const n = Number(numInput);
      correct = Number.isFinite(n) && Math.abs(n - q.answer) <= q.tolerance;
    }
    setLastCorrect(correct);
    setRevealed(true);
  };

  const next = () => {
    const nextResults = [...results, { answered: true, correct: lastCorrect }];
    setResults(nextResults);
    // reset working state
    setSelected(null);
    setBoolPick(null);
    setNumInput("");
    setRevealed(false);
    if (index + 1 >= questions.length) {
      setFinished(true);
      onComplete?.(nextResults.filter((r) => r.correct).length, questions.length);
    } else {
      setIndex(index + 1);
    }
  };

  const restart = () => {
    setIndex(0);
    setResults([]);
    setFinished(false);
    setSelected(null);
    setBoolPick(null);
    setNumInput("");
    setRevealed(false);
  };

  if (finished) {
    const pct = score / questions.length;
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">{pct >= 0.8 ? "🏆" : pct >= 0.5 ? "👍" : "📚"}</div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          คะแนนของคุณ: {score} / {questions.length}
        </h3>
        <ProgressBar fraction={pct} label="ความถูกต้อง" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {pct >= 0.8
            ? "เยี่ยมมาก! คุณเข้าใจเนื้อหาบทนี้ดีแล้ว"
            : pct >= 0.5
              ? "ทำได้ดี ลองทบทวนข้อที่ผิดอีกครั้ง"
              : "ไม่เป็นไร ลองกลับไปอ่าน concept แล้วทำใหม่นะ"}
        </p>
        <Button onClick={restart} variant="primary">
          🔁 ทำแบบทดสอบใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between">
        <Badge tone="slate">
          ข้อ {index + 1} / {questions.length}
        </Badge>
        <Badge tone="brand">คะแนน {score}</Badge>
      </div>
      <ProgressBar fraction={index / questions.length} showPercent={false} />

      <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{q.prompt}</p>

      {/* ---- answer inputs ---- */}
      {q.type === "mcq" && (
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isPicked = selected === i;
            const isAnswer = i === q.answerIndex;
            let cls =
              "border-slate-200 hover:border-brand-400 dark:border-slate-700";
            if (revealed) {
              if (isAnswer) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40";
              else if (isPicked) cls = "border-rose-500 bg-rose-50 dark:bg-rose-950/40";
            } else if (isPicked) {
              cls = "border-brand-500 bg-brand-50 dark:bg-brand-950/40";
            }
            return (
              <button
                key={i}
                disabled={revealed}
                onClick={() => setSelected(i)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm transition ${cls}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold dark:bg-slate-800">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === "boolean" && (
        <div className="flex gap-3">
          {[
            { label: "ถูก (True)", val: true },
            { label: "ผิด (False)", val: false },
          ].map((opt) => {
            const isPicked = boolPick === opt.val;
            const isAnswer = q.answer === opt.val;
            let cls = "border-slate-200 hover:border-brand-400 dark:border-slate-700";
            if (revealed) {
              if (isAnswer) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40";
              else if (isPicked) cls = "border-rose-500 bg-rose-50 dark:bg-rose-950/40";
            } else if (isPicked) cls = "border-brand-500 bg-brand-50 dark:bg-brand-950/40";
            return (
              <button
                key={opt.label}
                disabled={revealed}
                onClick={() => setBoolPick(opt.val)}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${cls}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "numeric" && (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={numInput}
              disabled={revealed}
              onChange={(e) => setNumInput(e.target.value)}
              aria-label="กรอกคำตอบเป็นตัวเลข"
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right font-mono tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-sm text-slate-500">{q.unit}</span>
          </div>
          {q.hint && !revealed && (
            <p className="mt-1 text-xs text-slate-400">💡 ใบ้: {q.hint}</p>
          )}
        </div>
      )}

      {/* ---- feedback ---- */}
      {revealed && (
        <Callout kind={lastCorrect ? "tip" : "warning"} title={lastCorrect ? "ถูกต้อง! ✅" : "ยังไม่ถูก ❌"}>
          {q.type === "numeric" && (
            <p className="mb-1">
              คำตอบที่ถูก: <strong>{formatNumber(q.answer)} {q.unit}</strong>
            </p>
          )}
          {q.explanation}
        </Callout>
      )}

      <div className="flex justify-end gap-2">
        {!revealed ? (
          <Button
            onClick={check}
            disabled={
              (q.type === "mcq" && selected === null) ||
              (q.type === "boolean" && boolPick === null) ||
              (q.type === "numeric" && numInput.trim() === "")
            }
          >
            ตรวจคำตอบ
          </Button>
        ) : (
          <Button onClick={next} variant="secondary">
            {index + 1 >= questions.length ? "ดูผลคะแนน" : "ข้อถัดไป →"}
          </Button>
        )}
      </div>
    </div>
  );
}
