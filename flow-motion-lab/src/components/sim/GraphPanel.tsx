const W = 320;
const H = 190;
const PAD = { l: 38, r: 12, t: 14, b: 30 };

export interface Series {
  points: { x: number; y: number }[];
  color: string;
  label?: string;
  /** Draw as dashed (e.g. a reference curve). */
  dashed?: boolean;
}

interface LineChartProps {
  series: Series[];
  xLabel?: string;
  yLabel?: string;
  /** Highlighted "current" point(s). */
  marker?: { x: number; y: number; color?: string };
  markers?: { x: number; y: number; color?: string; label?: string }[];
  /** Force domains; otherwise computed from data. */
  domain?: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** A lightweight, dependency-free SVG line chart that updates in real time. */
export function LineChart({ series, xLabel, yLabel, marker, markers, domain }: LineChartProps) {
  const allMarkers = [...(markers ?? []), ...(marker ? [marker] : [])];
  const all = series.flatMap((s) => s.points).concat(allMarkers);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xMin = domain?.xMin ?? (xs.length ? Math.min(...xs) : 0);
  const xMax = domain?.xMax ?? (xs.length ? Math.max(...xs) : 1);
  const yMin = domain?.yMin ?? Math.min(0, ys.length ? Math.min(...ys) : 0);
  const yMaxRaw = domain?.yMax ?? (ys.length ? Math.max(...ys) : 1);
  const yMax = yMaxRaw === yMin ? yMin + 1 : yMaxRaw;
  const xSpan = xMax === xMin ? 1 : xMax - xMin;
  const dom = { xMin, xMax, yMin, yMax };
  const sx = (x: number) => PAD.l + ((x - xMin) / xSpan) * (W - PAD.l - PAD.r);
  const sy = (y: number) =>
    H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${yLabel ?? ""} ${xLabel ?? ""}`}>
      {/* axes */}
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgb(var(--line))" />
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="rgb(var(--line))" />
      {/* gridlines + y ticks */}
      {[0, 0.5, 1].map((f) => {
        const y = PAD.t + f * (H - PAD.t - PAD.b);
        const val = dom.yMax - f * (dom.yMax - dom.yMin);
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgb(var(--line))" strokeDasharray="2 4" opacity={0.5} />
            <text x={PAD.l - 5} y={y + 3} textAnchor="end" className="fill-ink-faint" fontSize={9}>
              {Math.abs(val) >= 1000 ? val.toExponential(0) : val.toFixed(val < 10 ? 1 : 0)}
            </text>
          </g>
        );
      })}
      {series.map((s, i) =>
        s.points.length > 1 ? (
          <polyline
            key={i}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
          />
        ) : null,
      )}
      {allMarkers.map((m, i) => (
        <circle
          key={i}
          cx={sx(m.x)}
          cy={sy(m.y)}
          r={4.5}
          fill={m.color ?? "#06b6d4"}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}
      {xLabel && (
        <text x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle" className="fill-ink-faint" fontSize={10}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text x={10} y={H / 2} textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`} className="fill-ink-faint" fontSize={10}>
          {yLabel}
        </text>
      )}
    </svg>
  );
}

export interface Bar {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  bars: Bar[];
  unit?: string;
  /** Optional fixed max for a stable y-scale. */
  max?: number;
}

/** A compact SVG bar chart for energy-head / force comparisons. */
export function BarChart({ bars, unit, max }: BarChartProps) {
  const top = max ?? Math.max(1e-6, ...bars.map((b) => b.value));
  const bw = (W - PAD.l - PAD.r) / bars.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="แผนภูมิแท่ง">
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgb(var(--line))" />
      {bars.map((b, i) => {
        const h = Math.max(0, (b.value / top) * (H - PAD.t - PAD.b));
        const x = PAD.l + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const y = H - PAD.b - h;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={w} height={h} rx={3} fill={b.color} />
            <text x={x + w / 2} y={y - 4} textAnchor="middle" className="fill-ink" fontSize={9}>
              {b.value >= 100 ? b.value.toFixed(0) : b.value.toFixed(2)}
            </text>
            <text x={x + w / 2} y={H - PAD.b + 13} textAnchor="middle" className="fill-ink-faint" fontSize={9}>
              {b.label}
            </text>
          </g>
        );
      })}
      {unit && (
        <text x={PAD.l} y={11} className="fill-ink-faint" fontSize={9}>
          {unit}
        </text>
      )}
    </svg>
  );
}

interface GraphPanelProps {
  title: string;
  children: React.ReactNode;
}

/** Card wrapper around a chart. */
export default function GraphPanel({ title, children }: GraphPanelProps) {
  return (
    <div className="rounded-xl border border-line bg-surface-soft p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <span aria-hidden>📈</span> {title}
      </div>
      {children}
    </div>
  );
}
