import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import { useTheme } from "@/hooks/useTheme";

interface MiniPreviewProps {
  draw: (c: DrawContext) => void;
}

/**
 * A small, always-running preview animation for dashboard cards.
 * Each simulation provides a compact `draw` routine.
 */
export default function MiniPreview({ draw }: MiniPreviewProps) {
  const { theme } = useTheme();
  return (
    <div className="relative h-28 w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 ring-1 ring-white/10 dark:from-[#0a1426] dark:to-[#06101f]">
      <ParticleFlowCanvas
        draw={draw}
        playing
        speed={1}
        theme={theme}
        className="block h-full w-full"
        ariaLabel="ตัวอย่างภาพเคลื่อนไหว"
        zoomable={false}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18px_rgba(2,6,16,0.2)]" />
    </div>
  );
}
