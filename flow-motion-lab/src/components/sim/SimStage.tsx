import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SimControls } from "@/hooks/useSimControls";

interface SimStageProps {
  controls: SimControls;
  /** The canvas element (ParticleFlowCanvas). */
  children: ReactNode;
  /** Optional overlay, e.g. a pressure-colour legend. */
  legend?: ReactNode;
  /** DOM id of the explanation panel so the action button can scroll to it. */
  explanationId?: string;
}

/**
 * Frames the large central animation and hosts the brief's required action row:
 * อธิบายสิ่งที่กำลังเกิดขึ้น · ดูแบบช้า · ซ่อน/แสดงสูตร · ทดลองตัวอย่างจริง
 */
export default function SimStage({
  controls,
  children,
  legend,
  explanationId,
}: SimStageProps) {
  const scrollToExplain = () => {
    if (!explanationId) return;
    document.getElementById(explanationId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="group relative">
      {/* Soft aurora glow framing the central stage. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-br from-flow-400/30 via-deep-500/10 to-iris-500/30 opacity-70 blur-lg transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="lab-card relative overflow-hidden ring-1 ring-white/10">
        <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#0a1426] dark:to-[#060b16] sm:aspect-[16/10]">
          {children}

          {/* Faint engineering grid — radially masked so it reads as panel
              texture toward the edges and fades to nothing over the central
              action area, keeping on-canvas labels perfectly readable. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "34px 34px",
              color: "#22d3ee",
              WebkitMaskImage:
                "radial-gradient(120% 120% at 50% 50%, transparent 45%, black 100%)",
              maskImage:
                "radial-gradient(120% 120% at 50% 50%, transparent 45%, black 100%)",
            }}
          />

          {/* Very soft edge depth only — kept gentle so on-canvas labels near
              the edges stay fully readable. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(8,13,24,0.14)] dark:shadow-[inset_0_0_34px_rgba(2,6,16,0.28)]"
          />
          {/* Decorative corner brackets — small & faint so they never clip
              content the simulation draws in the corners. */}
          <span aria-hidden className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 rounded-tl border-l border-t border-flow-400/30" />
          <span aria-hidden className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 rounded-tr border-r border-t border-iris-400/30" />
          <span aria-hidden className="pointer-events-none absolute bottom-2 left-2 h-3.5 w-3.5 rounded-bl border-b border-l border-iris-400/30" />
          <span aria-hidden className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 rounded-br border-b border-r border-flow-400/30" />

          {!controls.playing && (
            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-amber-400" /> หยุดชั่วคราว
            </div>
          )}
          {legend && <div className="absolute bottom-3 right-3">{legend}</div>}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line p-3">
        <button
          type="button"
          onClick={scrollToExplain}
          className="lab-btn-ghost !py-2 !text-xs"
        >
          <span aria-hidden>💡</span> อธิบายสิ่งที่กำลังเกิดขึ้น
        </button>
        <button
          type="button"
          onClick={() => controls.setSpeed(0.25)}
          className="lab-btn-ghost !py-2 !text-xs"
        >
          <span aria-hidden>🐢</span> ดูแบบช้า
        </button>
        <button
          type="button"
          onClick={() => controls.setToggle("formula", !controls.toggles.formula)}
          className="lab-btn-ghost !py-2 !text-xs"
        >
          <span aria-hidden>ƒ</span> ซ่อน/แสดงสูตร
        </button>
        <Link to="/real-world" className="lab-btn-ghost !py-2 !text-xs">
          <span aria-hidden>🌍</span> ทดลองตัวอย่างจริง
        </Link>
        </div>
      </div>
    </div>
  );
}
