import { Link, useParams } from "react-router-dom";
import { CORE_LESSONS, getLesson } from "../data/lessons";
import { getLessonContent } from "../data/lessonContent";
import { FORMULAS } from "../data/formulas";
import { questionsForLesson } from "../data/quizzes";
import { useProgress } from "../context/ProgressContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Callout } from "../components/ui/Callout";
import { FormulaBox } from "../components/ui/FormulaBox";
import { Collapsible } from "../components/ui/Collapsible";
import { QuizRunner } from "../components/lesson/QuizRunner";

export function LessonPage() {
  const { id = "" } = useParams();
  const lesson = getLesson(id);
  const content = getLessonContent(id);
  const { isComplete, markComplete, recordQuizScore } = useProgress();

  if (!lesson || !content) {
    return (
      <Callout kind="warning" title="ไม่พบบทเรียน">
        ไม่พบบทเรียนนี้ —{" "}
        <Link to="/dashboard" className="underline">
          กลับไปหน้าแผนการเรียน
        </Link>
      </Callout>
    );
  }

  // prev/next within the numbered chapters
  const idx = CORE_LESSONS.findIndex((l) => l.id === id);
  const prev = idx > 0 ? CORE_LESSONS[idx - 1] : null;
  const next = idx >= 0 && idx < CORE_LESSONS.length - 1 ? CORE_LESSONS[idx + 1] : null;

  const relatedFormulas = FORMULAS.filter((f) =>
    content.relatedFormulaIds.includes(f.id),
  );
  const questions = questionsForLesson(id);
  const Simulator = content.simulator;

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {lesson.order !== null && <Badge tone="brand">บทที่ {lesson.order}</Badge>}
          {isComplete(id) && <Badge tone="green">✓ เรียนแล้ว</Badge>}
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          {lesson.title}
        </h1>
        <p className="mt-1 text-lg text-slate-500 dark:text-slate-400">{lesson.titleEn}</p>
      </div>

      {/* concept summary */}
      <Card className="p-5">
        <CardHeader title="แนวคิดสำคัญ (Concept summary)" icon="🧠" />
        <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
          {content.concept}
        </div>
      </Card>

      {/* formulas */}
      {relatedFormulas.length > 0 && (
        <Collapsible title="แสดงสูตร (Formulas)" icon="📐" defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedFormulas.map((f) => (
              <FormulaBox
                key={f.id}
                expression={f.expression}
                caption={`${f.name} (${f.nameEn})`}
              />
            ))}
          </div>
          <div className="mt-3 text-right">
            <Link to="/formulas" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
              ดู Formula Sheet เต็ม →
            </Link>
          </div>
        </Collapsible>
      )}

      {/* simulator */}
      {Simulator && (
        <Card className="p-5" as="section">
          <CardHeader
            title={content.simulatorTitle ?? "ทดลองเอง"}
            subtitle="ปรับค่าแล้วดูผลลัพธ์เปลี่ยนทันที"
            icon="🧪"
            action={<Badge tone="aqua">ทดลองเอง</Badge>}
          />
          <div className="mt-4">
            <Simulator />
          </div>
        </Card>
      )}

      {/* worked example */}
      <Collapsible title={`ดูตัวอย่างการคำนวณ — ${content.workedExample.title}`} icon="✏️">
        <div className="space-y-1">{content.workedExample.body}</div>
      </Collapsible>

      {/* assumptions */}
      {content.assumptions && (
        <Callout kind="assumption">{content.assumptions}</Callout>
      )}

      {/* mini quiz */}
      {questions.length > 0 && (
        <Card className="p-5" as="section">
          <CardHeader title="Mini Quiz" subtitle="ทดสอบความเข้าใจของบทนี้" icon="🎯" />
          <div className="mt-4">
            <QuizRunner
              questions={questions}
              compact
              onComplete={(correct, total) =>
                recordQuizScore(id, {
                  correct,
                  total,
                  takenAt: new Date().toISOString(),
                })
              }
            />
          </div>
        </Card>
      )}

      {/* key takeaways */}
      <Card className="p-5">
        <CardHeader title="Key Takeaway" icon="🔑" />
        <ul className="mt-3 space-y-2">
          {content.keyTakeaways.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="mt-0.5 text-emerald-500">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* complete + navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant={isComplete(id) ? "outline" : "primary"}
          onClick={() => markComplete(id)}
          disabled={isComplete(id)}
        >
          {isComplete(id) ? "✓ เรียนบทนี้แล้ว" : "ทำเครื่องหมายว่าเรียนจบ"}
        </Button>
        <div className="flex gap-2">
          {prev && (
            <Link to={prev.path}>
              <Button variant="ghost" size="sm">
                ← {prev.titleEn}
              </Button>
            </Link>
          )}
          {next && (
            <Link to={next.path}>
              <Button variant="secondary" size="sm">
                {next.titleEn} →
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
