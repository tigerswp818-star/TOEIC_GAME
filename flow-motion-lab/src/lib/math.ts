/** Small, dependency-free numeric helpers shared by every simulation. */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Map `value` from range [inMin,inMax] onto [outMin,outMax] (unclamped). */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
};

/** Map and clamp to the output range. */
export const mapClamped = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  const lo = Math.min(outMin, outMax);
  const hi = Math.max(outMin, outMax);
  return clamp(mapRange(value, inMin, inMax, outMin, outMax), lo, hi);
};

/** Round to a fixed number of decimals and return a number (not a string). */
export const round = (value: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/**
 * Format a number for on-screen display: keeps small numbers readable and
 * switches to scientific notation for very large / very small magnitudes.
 */
export const formatNumber = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e5 || abs < 1e-3)) {
    return value.toExponential(2);
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

/** Smooth Hermite interpolation between edge0 and edge1. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Approach `target` from `current` by `rate` (0..1) per call — frame-eased. */
export const approach = (current: number, target: number, rate: number): number =>
  current + (target - current) * clamp(rate, 0, 1);
