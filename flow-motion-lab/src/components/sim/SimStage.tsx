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
    <div className="lab-card overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#0a1426] dark:to-[#070d1a] sm:aspect-[16/10]">
        {children}
        {!controls.playing && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
            ⏸ หยุดชั่วคราว
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
  );
}
