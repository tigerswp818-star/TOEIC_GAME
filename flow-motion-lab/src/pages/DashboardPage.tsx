import { useState } from "react";
import { Link } from "react-router-dom";
import { CHAPTERS, LEVELS, LEARNING_PATHS, type Level } from "@/data/curriculum";
import { getSim, READY_SIMS } from "@/sims/registry";
import { useProgress } from "@/hooks/useProgress";

const LEVEL_ORDER: Level[] = ["basic", "intermediate", "advanced"];

export default function DashboardPage() {
  const [pathId, setPathId] = useState<string>("all");
  const progress = useProgress();

  const activePath = LEARNING_PATHS.find((p) => p.id === pathId);
  const visibleChapters = activePath
    ? CHAPTERS.filter((c) => activePath.chapterIds.includes(c.id))
    : CHAPTERS;

  const readyCount = (simIds: string[]) =>
    simIds.filter((id) => getSim(id)?.status === "ready").length;

  const quizPct =
    progress.quizAnswered > 0
      ? Math.round((progress.quizCorrect / progress.quizAnswered) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          แผนที่การเรียน <span className="text-aurora">Learning Map</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          หลักสูตร Fluid Mechanics 15 บท แบ่งเป็น 3 ระดับ — เห็นการไหลก่อน แล้วจึงเชื่อมกับสูตร
        </p>
      </header>

      {/* progress summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "บทที่เปิดแล้ว", value: `${progress.chapters.length}/${CHAPTERS.length}`, icon: "📚" },
          { label: "Simulation ที่ลอง", value: `${progress.sims.length}/${READY_SIMS.length}`, icon: "🧪" },
          { label: "โจทย์ที่ผ่าน", value: `${progress.challenges.length}`, icon: "🎯" },
          { label: "ความแม่นยำ Quiz", value: progress.quizAnswered ? `${quizPct}%` : "—", icon: "❓" },
        ].map((s) => (
          <div key={s.label} className="lab-card p-3">
            <div className="text-xl">{s.icon}</div>
            <div className="mt-1 font-mono text-xl font-bold text-ink">{s.value}</div>
            <div className="text-[11px] text-ink-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {/* learning path selector */}
      <div className="mb-6">
        <div className="mb-2 text-sm font-semibold text-ink">เส้นทางการเรียน Learning Path</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPathId("all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              pathId === "all"
                ? "border-flow-400 bg-flow-500/15 text-flow-600 dark:text-flow-200"
                : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"
            }`}
          >
            📖 ทั้งหมด All
          </button>
          {LEARNING_PATHS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPathId(p.id)}
              title={p.blurb}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                pathId === p.id
                  ? "border-flow-400 bg-flow-500/15 text-flow-600 dark:text-flow-200"
                  : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"
              }`}
            >
              {p.icon} {p.title}
            </button>
          ))}
        </div>
        {activePath && <p className="mt-2 text-xs text-ink-soft">{activePath.blurb}</p>}
      </div>

      {/* chapters grouped by level */}
      {LEVEL_ORDER.map((level) => {
        const chapters = visibleChapters.filter((c) => c.level === level);
        if (chapters.length === 0) return null;
        const meta = LEVELS[level];
        return (
          <section key={level} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className={`rounded-full bg-gradient-to-r ${meta.color} px-3 py-1 text-xs font-bold text-white`}>
                {meta.label} · {meta.labelEn}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((c) => {
                const ready = readyCount(c.simIds);
                const planned = (c.planned?.length ?? 0) + (c.simIds.length - ready);
                const visited = progress.chapters.includes(c.id);
                return (
                  <Link
                    key={c.id}
                    to={`/chapter/${c.id}`}
                    className="lab-card group p-4 transition hover:-translate-y-0.5 hover:shadow-glow"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${meta.color} text-xl`}>
                        {c.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                          บทที่ {c.number}
                          {visited && <span className="text-emerald-500">✓ เปิดแล้ว</span>}
                        </div>
                        <h3 className="font-bold leading-tight text-ink">{c.title}</h3>
                        <p className="text-xs text-ink-faint">{c.titleEn}</p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{c.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {ready > 0 && (
                        <span className="rounded-full bg-flow-500/15 px-2 py-0.5 font-semibold text-flow-600 dark:text-flow-300">
                          ▶ {ready} simulation
                        </span>
                      )}
                      {planned > 0 && (
                        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-ink-faint">
                          +{planned} เร็ว ๆ นี้
                        </span>
                      )}
                      {ready === 0 && planned === 0 && (
                        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-ink-faint">
                          เนื้อหา + ตัวอย่าง
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* tools */}
      <section className="mt-2 grid gap-3 sm:grid-cols-3">
        {[
          { to: "/formulas", icon: "📐", title: "รวมสูตร Formula Sheet" },
          { to: "/converter", icon: "🔁", title: "ตัวแปลงหน่วย Unit Converter" },
          { to: "/glossary", icon: "📖", title: "อภิธานศัพท์ Glossary" },
        ].map((t) => (
          <Link key={t.to} to={t.to} className="lab-card flex items-center gap-3 p-4 transition hover:shadow-glow">
            <span className="text-2xl">{t.icon}</span>
            <span className="font-semibold text-ink">{t.title}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
