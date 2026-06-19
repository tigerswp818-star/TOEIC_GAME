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
    <div className="rounded-lg bg-black/45 px-2.5 py-1.5 backdrop-blur">
      <div
        className="h-2 w-28 rounded-full"
        style={{ background: pressureGradientCss() }}
      />
      <div className="mt-1 flex justify-between text-[9px] font-medium text-white/90">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
