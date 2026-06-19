import { useMemo, useState } from "react";
import { QUIZ_QUESTIONS, questionsForLesson } from "../data/quizzes";
import { CORE_LESSONS } from "../data/lessons";
import { useProgress } from "../context/ProgressContext";
import { Card, CardHeader } from "../components/ui/Card";
import { QuizRunner } from "../components/lesson/QuizRunner";

export function QuizPage() {
  const [selected, setSelected] = useState<string>("all");
  const { recordQuizScore, quizScores } = useProgress();

  const questions = useMemo(
    () => (selected === "all" ? QUIZ_QUESTIONS : questionsForLesson(selected)),
    [selected],
  );

  const lessonsWithQuiz = CORE_LESSONS.filter(
    (l) => questionsForLesson(l.id).length > 0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          📝 แบบทดสอบ (Quiz)
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          เลือกบทที่ต้องการ หรือทำแบบรวมทุกบท — มี feedback ทันทีหลังตอบ
        </p>
      </div>

      {/* chapter selector */}
      <div className="flex flex-wrap gap-2">
        <Chip label={`รวมทุกบท (${QUIZ_QUESTIONS.length})`} active={selected === "all"} onClick={() => setSelected("all")} />
        {lessonsWithQuiz.map((l) => {
          const n = questionsForLesson(l.id).length;
          const sc = quizScores[l.id];
          return (
            <Chip
              key={l.id}
              label={`${l.titleEn} (${n})${sc ? ` · ${sc.correct}/${sc.total}` : ""}`}
              active={selected === l.id}
              onClick={() => setSelected(l.id)}
            />
          );
        })}
      </div>

      <Card className="p-5">
        <CardHeader
          title={selected === "all" ? "แบบทดสอบรวม" : CORE_LESSONS.find((l) => l.id === selected)?.title ?? ""}
          subtitle={`${questions.length} ข้อ`}
          icon="🎯"
        />
        <div className="mt-4">
          {/* key forces a fresh quiz when the chapter changes */}
          <QuizRunner
            key={selected}
            questions={questions}
            onComplete={(correct, total) => {
              if (selected !== "all") {
                recordQuizScore(selected, {
                  correct,
                  total,
                  takenAt: new Date().toISOString(),
                });
              }
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
