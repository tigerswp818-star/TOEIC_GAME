import { Link } from "react-router-dom";
import { CORE_LESSONS, LESSONS } from "../data/lessons";
import { useProgress } from "../context/ProgressContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";

export function DashboardPage() {
  const { isComplete, quizScores, completionFraction, resetProgress } = useProgress();
  const fraction = completionFraction(CORE_LESSONS.length);
  const tools = LESSONS.filter((l) => l.order === null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          แผนการเรียน (Learning Map)
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          เดินทางจากพื้นฐานของไหลไปจนถึง momentum — เรียนตามลำดับหรือกระโดดไปบทที่สนใจก็ได้
        </p>
      </div>

      {/* overall progress */}
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <ProgressBar fraction={fraction} label="ความคืบหน้าโดยรวม" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              เรียนจบแล้ว {CORE_LESSONS.filter((l) => isComplete(l.id)).length} จาก{" "}
              {CORE_LESSONS.length} บท
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("ล้างความคืบหน้าทั้งหมด? (ไม่สามารถย้อนกลับได้)")) resetProgress();
            }}
          >
            ↺ รีเซ็ตความคืบหน้า
          </Button>
        </div>
      </Card>

      {/* learning path */}
      <div className="space-y-3">
        {CORE_LESSONS.map((l, i) => {
          const done = isComplete(l.id);
          const score = quizScores[l.id];
          return (
            <Link key={l.id} to={l.path} className="block">
              <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                {/* step indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${l.accent} text-2xl shadow-sm`}
                  >
                    {l.icon}
                  </div>
                  {i < CORE_LESSONS.length - 1 && (
                    <div className="mt-1 h-3 w-0.5 bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      บทที่ {l.order}
                    </span>
                    {done && <Badge tone="green">✓ เรียนแล้ว</Badge>}
                    {score && (
                      <Badge tone="brand">
                        Quiz {score.correct}/{score.total}
                      </Badge>
                    )}
                  </div>
                  <h3 className="truncate font-bold text-slate-900 dark:text-white">
                    {l.title}
                  </h3>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {l.titleEn} · {l.summary}
                  </p>
                </div>
                <span className="shrink-0 text-slate-300 dark:text-slate-600">→</span>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* tools */}
      <div>
        <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
          เครื่องมือและบทพิเศษ
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tools.map((l) => (
            <Link key={l.id} to={l.path}>
              <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
                <span className="text-2xl">{l.icon}</span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{l.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{l.summary}</p>
                </div>
              </Card>
            </Link>
          ))}
          <Link to="/quiz">
            <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">แบบทดสอบรวม (Quiz)</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ทดสอบความเข้าใจรายบทหรือแบบรวมทุกบท
                </p>
              </div>
            </Card>
          </Link>
          <Link to="/examples">
            <Card className="flex items-center gap-3 p-4 transition hover:shadow-md">
              <span className="text-2xl">🌍</span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  ตัวอย่างในชีวิตจริง
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ทำไมเขื่อนหนาที่ฐาน เครื่องบินบินได้ เรือเหล็กลอยน้ำ
                </p>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
