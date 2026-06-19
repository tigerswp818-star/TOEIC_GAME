import { Link } from "react-router-dom";
import { SIMULATIONS } from "@/sims/registry";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          ห้องทดลองของไหล <span className="text-flow-500">Simulation Lab</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          เลือกหัวข้อเพื่อเข้าสู่การทดลอง — ทุก card มีตัวอย่างภาพเคลื่อนไหวจริง ไม่ใช่รูปนิ่ง
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATIONS.map((s) => {
          const ready = s.status === "ready";
          const Preview = s.Preview;
          const card = (
            <>
              <div className="relative">
                {ready && Preview ? (
                  <Preview />
                ) : (
                  <div className="grid h-28 w-full place-items-center rounded-xl bg-surface-soft text-4xl opacity-50">
                    {s.icon}
                  </div>
                )}
                {!ready && (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white">
                    เร็ว ๆ นี้ Soon
                  </span>
                )}
              </div>
              <div className="mt-3.5 flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.accent} text-xl`}>
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-ink">{s.title}</h3>
                  <p className="text-xs text-ink-faint">{s.titleEn}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{s.tagline}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-xs text-flow-600 dark:text-flow-300">{s.formula}</span>
                {ready && (
                  <span className="text-sm font-semibold text-flow-600 group-hover:underline dark:text-flow-300">
                    เปิดทดลอง →
                  </span>
                )}
              </div>
            </>
          );

          return ready ? (
            <Link
              key={s.id}
              to={`/sim/${s.id}`}
              className="lab-card group p-4 transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              {card}
            </Link>
          ) : (
            <div key={s.id} className="lab-card cursor-not-allowed p-4 opacity-80">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
