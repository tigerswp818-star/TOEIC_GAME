import { describe, it, expect } from "vitest";
import { clamp, lerp, mapRange, mapClamped, round, formatNumber, smoothstep, approach } from "./math";

describe("clamp", () => {
  it("inside range unchanged", () => expect(clamp(5, 0, 10)).toBe(5));
  it("below min", () => expect(clamp(-3, 0, 10)).toBe(0));
  it("above max", () => expect(clamp(99, 0, 10)).toBe(10));
});

describe("lerp", () => {
  it("t=0 → a, t=1 → b, t=0.5 → midpoint", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("mapRange / mapClamped", () => {
  it("maps linearly", () => expect(mapRange(5, 0, 10, 0, 100)).toBe(50));
  it("degenerate input range returns outMin", () => expect(mapRange(5, 2, 2, 0, 100)).toBe(0));
  it("mapClamped clamps to output range (incl. reversed)", () => {
    expect(mapClamped(20, 0, 10, 0, 100)).toBe(100);
    expect(mapClamped(-5, 0, 10, 0, 100)).toBe(0);
    expect(mapClamped(20, 0, 10, 100, 0)).toBe(0);
  });
});

describe("round", () => {
  it("rounds to decimals", () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(2.5, 0)).toBe(3);
  });
});

describe("formatNumber", () => {
  it("renders normal numbers", () => expect(formatNumber(1234.567, 2)).toBe("1,234.57"));
  it("uses scientific notation for very large", () => expect(formatNumber(123456, 2)).toMatch(/e/i));
  it("uses scientific notation for very small non-zero", () => expect(formatNumber(0.0001, 2)).toMatch(/e/i));
  it("non-finite → em dash", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
  });
});

describe("smoothstep", () => {
  it("0 below edge0, 1 above edge1, 0.5 at midpoint", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });
  it("monotonic increasing across the band", () => {
    expect(smoothstep(0, 1, 0.25)).toBeLessThan(smoothstep(0, 1, 0.75));
  });
});

describe("approach", () => {
  it("rate 1 reaches target, rate 0 stays put", () => {
    expect(approach(0, 10, 1)).toBe(10);
    expect(approach(0, 10, 0)).toBe(0);
    expect(approach(0, 10, 0.5)).toBe(5);
  });
  it("rate is clamped to [0,1]", () => {
    expect(approach(0, 10, 5)).toBe(10);
    expect(approach(0, 10, -1)).toBe(0);
  });
});
