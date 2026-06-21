/**
 * Colour helpers for the simulations: pressure colour maps, velocity tints and
 * depth shading. Everything returns canvas-ready CSS colour strings.
 */
import { clamp } from "./math";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const lerpRGB = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export const rgbToCss = (c: RGB, alpha = 1): string =>
  `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

/**
 * Pressure colour map: low pressure → cool cyan/blue, high pressure → warm
 * red/orange. `t` in [0,1] where 0 = lowest pressure, 1 = highest.
 * Reads as a thermal/pressure scale that students intuitively understand.
 */
const PRESSURE_STOPS: RGB[] = [
  { r: 37, g: 99, b: 235 }, // deep blue  (lowest)
  { r: 34, g: 211, b: 238 }, // cyan
  { r: 74, g: 222, b: 128 }, // green
  { r: 250, g: 204, b: 21 }, // yellow
  { r: 249, g: 115, b: 22 }, // orange
  { r: 239, g: 68, b: 68 }, // red       (highest)
];

export const pressureColor = (t: number, alpha = 1): string => {
  const x = clamp(t, 0, 1) * (PRESSURE_STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = PRESSURE_STOPS[i];
  const b = PRESSURE_STOPS[Math.min(i + 1, PRESSURE_STOPS.length - 1)];
  return rgbToCss(lerpRGB(a, b, f), alpha);
};

/** CSS gradient string for legends / bars (low → high, left → right). */
export const pressureGradientCss = (): string =>
  `linear-gradient(90deg, ${PRESSURE_STOPS.map(
    (c, i) =>
      `${rgbToCss(c)} ${(i / (PRESSURE_STOPS.length - 1)) * 100}%`,
  ).join(", ")})`;

/**
 * Velocity tint: slow → soft cyan, fast → bright white-cyan.
 * Used for particles so faster fluid visibly "glows".
 */
export const velocityColor = (t: number, alpha = 1): string => {
  const slow: RGB = { r: 14, g: 116, b: 144 };
  const fast: RGB = { r: 165, g: 243, b: 252 };
  return rgbToCss(lerpRGB(slow, fast, clamp(t, 0, 1)), alpha);
};

/**
 * Particle velocity ramp for the "modern scientific" look: slow → light cyan,
 * medium → blue, fast → violet. Returns an "r, g, b" channel string for use
 * with softGlow / drawFlowParticle. `t` in [0,1].
 */
const VEL_RAMP: RGB[] = [
  { r: 125, g: 232, b: 249 }, // light cyan (slow)
  { r: 59, g: 130, b: 246 }, // blue
  { r: 167, g: 139, b: 250 }, // violet (fast)
];
export const velocityRampRGB = (t: number): string => {
  const x = clamp(t, 0, 1) * (VEL_RAMP.length - 1);
  const i = Math.floor(x);
  const c = lerpRGB(VEL_RAMP[i], VEL_RAMP[Math.min(i + 1, VEL_RAMP.length - 1)], x - i);
  return `${c.r}, ${c.g}, ${c.b}`;
};

/**
 * Water depth shading: surface → light, deep → dark blue. `t` in [0,1] where
 * 0 = surface, 1 = bottom. Used by the hydrostatic / buoyancy tanks.
 */
export const depthColor = (t: number, alpha = 1): string => {
  const surface: RGB = { r: 125, g: 211, b: 252 };
  const bottom: RGB = { r: 12, g: 41, b: 84 };
  return rgbToCss(lerpRGB(surface, bottom, clamp(t, 0, 1)), alpha);
};
