import { useId } from "react";
import { formatNumber } from "../../utils/format";

export interface Point {
  x: number;
  y: number;
}

interface LineChartProps {
  data: Point[];
  /** Optional highlighted point (e.g. the current slider state). */
  marker?: Point | null;
  xLabel: string;
  yLabel: string;
  /** Force the axes to start at zero (common for physical quantities). */
  originZero?: boolean;
  height?: number;
  className?: string;
  color?: string;
}

/**
 * Minimal dependency-free SVG line chart with auto-scaled axes. Built for small
 * pedagogical plots (Pressure vs Depth, head loss vs velocity, …).
 */
export function LineChart({
  data,
  marker,
  xLabel,
  yLabel,
  originZero = true,
  height = 220,
  className = "",
  color = "#2479ea",
}: LineChartProps) {
  const gradientId = useId();
  const width = 360;
  const pad = { top: 16, right: 16, bottom: 36, left: 48 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const allX = marker ? [...xs, marker.x] : xs;
  const allY = marker ? [...ys, marker.y] : ys;

  const xMin = originZero ? 0 : Math.min(...allX);
  const xMax = Math.max(...allX, xMin + 1e-9);
  const yMin = originZero ? 0 : Math.min(...allY);
  const yMax = Math.max(...allY, yMin + 1e-9);

  const sx = (x: number) =>
    pad.left + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (y: number) =>
    pad.top + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${sx(d.x).toFixed(1)} ${sy(d.y).toFixed(1)}`)
    .join(" ");
  const areaPath =
    data.length > 1
      ? `${path} L ${sx(data[data.length - 1].x).toFixed(1)} ${sy(yMin).toFixed(
          1,
        )} L ${sx(data[0].x).toFixed(1)} ${sy(yMin).toFixed(1)} Z`
      : "";

  // 4 gridlines on each axis.
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full ${className}`}
      role="img"
      aria-label={`กราฟ ${yLabel} เทียบกับ ${xLabel}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + tick labels */}
      {ticks.map((t) => {
        const y = pad.top + innerH * (1 - t);
        const val = yMin + (yMax - yMin) * t;
        return (
          <g key={`y${t}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-slate-400 text-[9px]"
            >
              {formatNumber(val, 2)}
            </text>
          </g>
        );
      })}
      {ticks.map((t) => {
        const x = pad.left + innerW * t;
        const val = xMin + (xMax - xMin) * t;
        return (
          <text
            key={`x${t}`}
            x={x}
            y={height - pad.bottom + 14}
            textAnchor="middle"
            className="fill-slate-400 text-[9px]"
          >
            {formatNumber(val, 2)}
          </text>
        );
      })}

      {/* axes */}
      <line
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + innerH}
        className="stroke-slate-300 dark:stroke-slate-600"
      />
      <line
        x1={pad.left}
        y1={pad.top + innerH}
        x2={width - pad.right}
        y2={pad.top + innerH}
        className="stroke-slate-300 dark:stroke-slate-600"
      />

      {/* area + line */}
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} />

      {/* current-state marker */}
      {marker && Number.isFinite(marker.x) && Number.isFinite(marker.y) && (
        <g>
          <line
            x1={sx(marker.x)}
            y1={pad.top + innerH}
            x2={sx(marker.x)}
            y2={sy(marker.y)}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <circle
            cx={sx(marker.x)}
            cy={sy(marker.y)}
            r={5}
            fill="#fff"
            stroke={color}
            strokeWidth={2.5}
          />
        </g>
      )}

      {/* axis labels */}
      <text
        x={pad.left + innerW / 2}
        y={height - 4}
        textAnchor="middle"
        className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
      >
        {xLabel}
      </text>
      <text
        x={-(pad.top + innerH / 2)}
        y={12}
        textAnchor="middle"
        transform="rotate(-90)"
        className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
      >
        {yLabel}
      </text>
    </svg>
  );
}
