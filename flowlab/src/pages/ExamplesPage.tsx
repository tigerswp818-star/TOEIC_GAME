import { Link } from "react-router-dom";
import { REAL_WORLD_EXAMPLES } from "../data/examples";
import { getLesson } from "../data/lessons";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export function ExamplesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          🌍 ตัวอย่างในชีวิตจริง (Real-world Examples)
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          เชื่อมทฤษฎีเข้ากับสิ่งรอบตัว — กดเข้าไปเรียนบทที่เกี่ยวข้องได้เลย
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REAL_WORLD_EXAMPLES.map((ex) => (
          <Card key={ex.id} className="flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-aqua-50 text-2xl dark:bg-aqua-950/50">
                {ex.icon}
              </span>
              <h3 className="font-bold leading-snug text-slate-900 dark:text-white">
                {ex.title}
              </h3>
            </div>
            <p className="mt-3 text-sm font-medium italic text-slate-500 dark:text-slate-400">
              “{ex.question}”
            </p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {ex.explanation}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ex.relatedLessonIds.map((id) => {
                const lesson = getLesson(id);
                if (!lesson) return null;
                return (
                  <Link key={id} to={lesson.path}>
                    <Badge tone="brand">
                      {lesson.icon} {lesson.titleEn} →
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
