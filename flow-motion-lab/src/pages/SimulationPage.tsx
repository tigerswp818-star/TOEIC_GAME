import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSim } from "@/sims/registry";
import { chapterOfSim } from "@/data/curriculum";
import { getChapterContent } from "@/data/chapterContent";
import { useProgress } from "@/hooks/useProgress";
import { useClassroom } from "@/hooks/useClassroom";
import AccuracyNote from "@/components/sim/AccuracyNote";

export default function SimulationPage() {
  const { id } = useParams();
  const sim = id ? getSim(id) : undefined;
  const { markSim } = useProgress();
  const classroom = useClassroom();
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Remounting the sim (changing its key) gives a full "reset demo".
  const [demoKey, setDemoKey] = useState(0);

  useEffect(() => {
    if (sim && sim.status === "ready") markSim(sim.id);
  }, [sim, markSim]);

  // Leaving the page should always exit Classroom Mode + fullscreen.
  useEffect(
    () => () => {
      classroom.setActive(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!sim) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-5xl">🤔</p>
        <h1 className="mt-4 text-xl font-bold text-ink">ไม่พบการทดลองนี้</h1>
        <Link to="/lab" className="lab-btn-primary mt-6">
          ← กลับห้องทดลอง
        </Link>
      </div>
    );
  }

  if (sim.status !== "ready" || !sim.Sim) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-6xl">{sim.icon}</p>
        <h1 className="mt-4 text-2xl font-bold text-ink">{sim.title}</h1>
        <p className="text-sm text-ink-faint">{sim.titleEn}</p>
        <span className="lab-chip mt-4 !bg-amber-500/15 !text-amber-600 dark:!text-amber-300">
          🚧 กำลังพัฒนา — เร็ว ๆ นี้
        </span>
        <p className="mt-4 text-sm text-ink-soft">{sim.tagline}</p>
        <Link to="/lab" className="lab-btn-primary mt-6">
          ← เลือกการทดลองอื่น
        </Link>
      </div>
    );
  }

  const Sim = sim.Sim;
  const teacherNotes = (() => {
    const ch = chapterOfSim(sim.id);
    return ch ? getChapterContent(ch.id)?.teacherNotes ?? [] : [];
  })();

  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
      classroom.setActive(true);
    }
  };

  return (
    <div ref={wrapperRef} className={classroom.active ? "classroom-mode bg-surface" : ""}>
      {/* Classroom Mode toolbar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={classroom.toggle}
          aria-pressed={classroom.active}
          className={classroom.active ? "lab-btn-primary !py-2 !text-sm" : "lab-btn-ghost !py-2 !text-sm"}
        >
          <span aria-hidden>🎓</span> โหมดห้องเรียน {classroom.active ? "(เปิด)" : ""}
        </button>
        {classroom.active && (
          <>
            <button type="button" onClick={toggleFullscreen} className="lab-btn-ghost !py-2 !text-sm">
              <span aria-hidden>⛶</span> เต็มจอ
            </button>
            <button
              type="button"
              onClick={() => setDemoKey((k) => k + 1)}
              className="lab-btn-ghost !py-2 !text-sm"
            >
              <span aria-hidden>↺</span> รีเซ็ตเดโม
            </button>
            <span className="text-xs text-ink-faint">ซ่อนปุ่มขั้นสูงแล้ว · ป้ายใหญ่ขึ้นสำหรับการสอน</span>
          </>
        )}
      </div>

      {classroom.active && teacherNotes.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
          <section className="rounded-xl border border-flow-500/30 bg-flow-500/5 p-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-flow-700 dark:text-flow-200">
              <span aria-hidden>👩‍🏫</span> โน้ตสำหรับผู้สอน (Teacher Notes)
            </h2>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-ink-soft">
              {teacherNotes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-flow-500">{i + 1}.</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <AccuracyNote simId={sim.id} />
      <Sim key={demoKey} />
    </div>
  );
}
