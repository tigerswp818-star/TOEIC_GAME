import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { getSim } from "@/sims/registry";
import { useProgress } from "@/hooks/useProgress";

export default function SimulationPage() {
  const { id } = useParams();
  const sim = id ? getSim(id) : undefined;
  const { markSim } = useProgress();

  useEffect(() => {
    if (sim && sim.status === "ready") markSim(sim.id);
  }, [sim, markSim]);

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
  return <Sim />;
}
