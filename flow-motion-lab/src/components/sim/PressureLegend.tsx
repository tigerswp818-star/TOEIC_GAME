import { pressureGradientCss } from "@/lib/colors";

interface PressureLegendProps {
  lowLabel?: string;
  highLabel?: string;
}

/** Compact legend for the pressure colour map shown over a simulation. */
export default function PressureLegend({
  lowLabel = "ความดันต่ำ",
  highLabel = "ความดันสูง",
}: PressureLegendProps) {
  return (
    <div className="rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 shadow-glass backdrop-blur">
      <div
        className="h-2 w-28 rounded-full ring-1 ring-white/20"
        style={{ background: pressureGradientCss() }}
      />
      <div className="mt-1 flex justify-between text-[9px] font-medium text-white/90">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
