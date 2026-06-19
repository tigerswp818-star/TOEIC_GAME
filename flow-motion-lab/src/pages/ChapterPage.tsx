import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { getChapter, LEVELS } from "@/data/curriculum";
import { getSim } from "@/sims/registry";
import { useProgress } from "@/hooks/useProgress";

export default function ChapterPage() {
  const { id } = useParams();
  const chapter = id ? getChapter(id) : undefined;
  const { markChapter } = useProgress();

  useEffect(() => {
    if (chapter) markChapter(chapter.id);
  }, [chapter, markChapter]);

  if (!chapter) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-5xl">🤔</p>
        <h1 className="mt-4 text-xl font-bold text-ink">ไม่พบบทเรียนนี้</h1>
        <Link to="/lab" className="lab-btn-primary mt-6">
          ← กลับแผนที่การเรียน
        </Link>
      </div>
    );
  }

  const meta = LEVELS[chapter.level];
  const sims = chapter.simIds.map(getSim).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const readySims = sims.filter((s) => s.status === "ready");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/lab" className="lab-btn-ghost !px-3 !py-2 text-sm" aria-label="กลับแผนที่การเรียน">
          ←
        </Link>
        <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${meta.color} text-2xl`}>
          {chapter.icon}
        </span>
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            บทที่ {chapter.number}
            <span className={`rounded-full bg-gradient-to-r ${meta.color} px-2 py-0.5 font-bold text-white`}>
              {meta.label}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight text-ink sm:text-2xl">{chapter.title}</h1>
          <p className="text-xs text-ink-faint">{chapter.titleEn}</p>
        </div>
      </div>

      <p className="mb-6 text-sm text-ink-soft">{chapter.summary}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* objectives + topics */}
        <div className="space-y-4 lg:col-span-1">
          <div className="lab-card p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
              🎯 จุดประสงค์การเรียนรู้
            </h2>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              {chapter.objectives.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-flow-500">•</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lab-card p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">📋 หัวข้อ Topics</h2>
            <div className="flex flex-wrap gap-1.5">
              {chapter.topics.map((t) => (
                <span key={t} className="lab-chip !text-[11px]">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* simulations */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-ink">
            🧪 การทดลองในบทนี้ ({readySims.length} พร้อมใช้)
          </h2>

          {chapter.id === "ch15" && (
            <Link to="/real-world" className="lab-card flex items-center gap-3 p-4 transition hover:shadow-glow">
              <span className="text-2xl">🌍</span>
              <div>
                <div className="font-bold text-ink">ดูตัวอย่างในชีวิตจริง</div>
                <div className="text-xs text-ink-soft">กรณีศึกษาวิศวกรรมพร้อมภาพเคลื่อนไหวสั้น ๆ</div>
              </div>
            </Link>
          )}

          {readySims.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {readySims.map((s) => {
                const Preview = s.Preview;
                return (
                  <Link
                    key={s.id}
                    to={`/sim/${s.id}`}
                    className="lab-card group overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-glow"
                  >
                    {Preview && <Preview />}
                    <div className="mt-3 flex items-center gap-2">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-lg`}>
                        {s.icon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold leading-tight text-ink">{s.title}</h3>
                        <p className="text-[11px] text-ink-faint">{s.titleEn}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-ink-soft">{s.tagline}</p>
                    <p className="mt-2 font-mono text-xs text-flow-600 dark:text-flow-300">{s.formula}</p>
                  </Link>
                );
              })}
            </div>
          )}

          {chapter.planned && chapter.planned.length > 0 && (
            <div className="lab-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">🚧 กำลังพัฒนา — เร็ว ๆ นี้</h3>
              <div className="flex flex-wrap gap-1.5">
                {chapter.planned.map((p) => (
                  <span key={p} className="rounded-full bg-surface-soft px-2.5 py-1 text-xs text-ink-faint">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {readySims.length === 0 && chapter.id !== "ch15" && (!chapter.planned || chapter.planned.length === 0) && (
            <div className="lab-card p-6 text-center text-sm text-ink-faint">
              เนื้อหาและการทดลองของบทนี้กำลังจัดทำ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
