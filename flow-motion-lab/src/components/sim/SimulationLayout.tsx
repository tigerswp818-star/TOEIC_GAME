import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface SimulationLayoutProps {
  title: string;
  titleEn: string;
  icon: string;
  /** Left rail: sliders & numeric inputs. */
  controls: ReactNode;
  /** Centre stage: the large live animation. */
  stage: ReactNode;
  /** Right rail: results, formula, explanation, graph. */
  results: ReactNode;
  /** Full-width area below (quiz, etc.). */
  bottom?: ReactNode;
}

/**
 * The canonical per-simulation layout:
 *  - desktop: [controls | stage | results] three columns
 *  - mobile: stage first, then controls, then results (visual-first).
 */
export default function SimulationLayout({
  title,
  titleEn,
  icon,
  controls,
  stage,
  results,
  bottom,
}: SimulationLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl animate-fade-in px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/lab" className="lab-btn-ghost !px-3 !py-2 text-sm" aria-label="กลับห้องทดลอง">
          ←
        </Link>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-flow-400 via-deep-500 to-iris-600 text-2xl shadow-glow ring-1 ring-white/15">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="bg-gradient-to-r from-ink to-ink-soft bg-clip-text text-lg font-extrabold leading-tight tracking-tight text-transparent sm:text-2xl dark:from-white dark:to-ink-soft">
            {title}
          </h1>
          <p className="font-mono text-xs text-flow-600 dark:text-flow-300/80">{titleEn}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_350px]">
        <div className="order-2 space-y-4 lg:order-1">{controls}</div>
        <div className="order-1 space-y-4 lg:order-2">{stage}</div>
        <div className="order-3 space-y-4">{results}</div>
      </div>

      {bottom && <div className="mt-6">{bottom}</div>}
    </div>
  );
}
