/**
 * Number-formatting helpers for readable scientific output.
 */

/**
 * Format a number for display, automatically switching to scientific notation
 * for very large or very small magnitudes so the UI never shows "0.0000001" or
 * an 11-digit integer.
 */
export function formatNumber(value: number, sigFigs = 4): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";

  const abs = Math.abs(value);
  // Use scientific notation outside a comfortable human-readable band.
  if (abs >= 1e6 || abs < 1e-3) {
    return value.toExponential(Math.max(0, sigFigs - 1));
  }
  // Otherwise pick a sensible number of decimals based on magnitude.
  const decimals =
    abs >= 100 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 2 : 3;
  const fixed = value.toFixed(decimals);
  // Trim trailing zeros but keep at least one decimal place when there is a dot.
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Format with a unit suffix, e.g. "101.3 kPa". */
export function formatWithUnit(value: number, unit: string, sigFigs = 4): string {
  return `${formatNumber(value, sigFigs)} ${unit}`;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to a number of decimal places (returns a number, not a string). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Format a percentage 0..1 → "37%". */
export function formatPercent(fraction: number): string {
  return `${Math.round(clamp(fraction, 0, 1) * 100)}%`;
}
