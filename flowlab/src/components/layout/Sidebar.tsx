import { NavLink } from "react-router-dom";
import { CORE_LESSONS, LESSONS } from "../../data/lessons";
import { useProgress } from "../../context/ProgressContext";
import { ProgressBar } from "../ui/ProgressBar";

interface SidebarProps {
  /** Whether the mobile drawer is open. */
  open: boolean;
  /** Close handler for the mobile drawer. */
  onClose: () => void;
}

const extraLinks = [
  { path: "/quiz", label: "แบบทดสอบ (Quiz)", icon: "📝" },
  { path: "/examples", label: "ตัวอย่างจริง (Examples)", icon: "🌍" },
  { path: "/glossary", label: "อภิธานศัพท์ (Glossary)", icon: "📖" },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { isComplete, completedLessons } = useProgress();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-brand-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  const chapters = LESSONS.filter((l) => l.order !== null);
  const specials = LESSONS.filter((l) => l.order === null);

  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`scroll-thin fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="เมนูนำทาง"
      >
        <NavLink to="/" className="mb-4 flex items-center gap-2 px-2" onClick={onClose}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg">
            🌊
          </span>
          <div>
            <div className="font-extrabold leading-tight text-slate-900 dark:text-white">
              FlowLab
            </div>
            <div className="text-[10px] text-slate-400">Interactive Fluid Mechanics</div>
          </div>
        </NavLink>

        <NavLink to="/dashboard" className={linkClass} onClick={onClose}>
          <span>🗺️</span> แผนการเรียน (Dashboard)
        </NavLink>

        <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          บทเรียน
        </div>
        <nav className="mt-1 space-y-1">
          {chapters.map((l) => (
            <NavLink key={l.id} to={l.path} className={linkClass} onClick={onClose}>
              <span>{l.icon}</span>
              <span className="flex-1">
                <span className="text-xs text-slate-400">บทที่ {l.order} · </span>
                {l.titleEn}
              </span>
              {isComplete(l.id) && <span className="text-emerald-500">✓</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          เครื่องมือ
        </div>
        <nav className="mt-1 space-y-1">
          {specials.map((l) => (
            <NavLink key={l.id} to={l.path} className={linkClass} onClick={onClose}>
              <span>{l.icon}</span> {l.titleEn}
            </NavLink>
          ))}
          {extraLinks.map((l) => (
            <NavLink key={l.path} to={l.path} className={linkClass} onClick={onClose}>
              <span>{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <ProgressBar
            fraction={completedLessons.filter((id) => CORE_LESSONS.some((l) => l.id === id)).length / CORE_LESSONS.length}
            label="ความคืบหน้า"
          />
        </div>
      </aside>
    </>
  );
}
