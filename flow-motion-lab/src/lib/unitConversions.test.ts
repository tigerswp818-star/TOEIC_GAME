import { describe, it, expect } from "vitest";
import { convert, UNIT_CATEGORIES, findCategory, findUnit } from "./unitConversions";

const close = (a: number, b: number, tolRel = 1e-4) =>
  Math.abs(a - b) <= tolRel * Math.max(1, Math.abs(b));

describe("unit catalogue integrity", () => {
  it("every category has a base unit with factor 1", () => {
    for (const cat of UNIT_CATEGORIES) {
      const base = findUnit(cat, cat.base);
      expect(base, `${cat.id} base ${cat.base}`).toBeDefined();
      expect(base!.factor).toBe(1);
    }
  });
  it("all factors are positive finite numbers", () => {
    for (const cat of UNIT_CATEGORIES) {
      for (const u of cat.units) {
        expect(Number.isFinite(u.factor) && u.factor > 0, `${cat.id}/${u.symbol}`).toBe(true);
      }
    }
  });
});

describe("pressure conversions", () => {
  it("1 atm = 101325 Pa", () => expect(close(convert(1, "atm", "Pa", "pressure"), 101325)).toBe(true));
  it("1 bar = 100 kPa", () => expect(close(convert(1, "bar", "kPa", "pressure"), 100)).toBe(true));
  it("1 psi ≈ 6894.76 Pa", () => expect(close(convert(1, "psi", "Pa", "pressure"), 6894.76)).toBe(true));
  it("round trip Pa→psi→Pa is identity", () => {
    const psi = convert(250000, "Pa", "psi", "pressure");
    expect(close(convert(psi, "psi", "Pa", "pressure"), 250000)).toBe(true);
  });
});

describe("length / area / volume conversions", () => {
  it("1 inch = 25.4 mm", () => expect(close(convert(1, "inch", "mm", "length"), 25.4)).toBe(true));
  it("1 ft = 0.3048 m", () => expect(close(convert(1, "ft", "m", "length"), 0.3048)).toBe(true));
  it("1 m³ = 1000 L", () => expect(close(convert(1, "m³", "L", "volume"), 1000)).toBe(true));
  it("1 m² = 10000 cm²", () => expect(close(convert(1, "m²", "cm²", "area"), 10000)).toBe(true));
});

describe("flow rate / velocity / density / power", () => {
  it("1 m³/s = 1000 L/s", () => expect(close(convert(1, "m³/s", "L/s", "flow"), 1000)).toBe(true));
  it("1 m/s = 3.6 km/h", () => expect(close(convert(1, "m/s", "km/h", "velocity"), 3.6)).toBe(true));
  it("1 g/cm³ = 1000 kg/m³", () => expect(close(convert(1, "g/cm³", "kg/m³", "density"), 1000)).toBe(true));
  it("1 hp ≈ 745.7 W", () => expect(close(convert(1, "hp", "W", "power"), 745.7)).toBe(true));
});

describe("viscosity conversions", () => {
  it("1 cP = 0.001 Pa·s", () => expect(close(convert(1, "cP", "Pa·s", "dynamic-viscosity"), 0.001)).toBe(true));
  it("1 cSt = 1e-6 m²/s", () => expect(close(convert(1, "cSt", "m²/s", "kinematic-viscosity"), 1e-6)).toBe(true));
});

describe("identity and error handling", () => {
  it("same unit returns the same value", () => expect(convert(42, "Pa", "Pa", "pressure")).toBe(42));
  it("unknown category → NaN", () => expect(Number.isNaN(convert(1, "Pa", "Pa", "nope"))).toBe(true));
  it("unknown unit → NaN", () => expect(Number.isNaN(convert(1, "zzz", "Pa", "pressure"))).toBe(true));
  it("findCategory returns undefined for unknown id", () => expect(findCategory("nope")).toBeUndefined());
});
