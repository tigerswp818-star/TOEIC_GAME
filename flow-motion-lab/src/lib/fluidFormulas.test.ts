import { describe, it, expect } from "vitest";
import {
  density,
  pressureFromForce,
  hydrostaticPressure,
  buoyantForce,
  weight,
  flowRate,
  continuityVelocity,
  circleArea,
  bernoulliPressure,
  pressureHead,
  velocityHead,
  reynoldsNumber,
  flowRegime,
  majorHeadLoss,
  minorHeadLoss,
  vortexTangentialSpeed,
} from "./fluidFormulas";
import { GRAVITY } from "./constants";

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

describe("density ρ = m/V", () => {
  it("normal case: 1000 kg in 1 m³ → 1000 kg/m³", () => {
    expect(density(1000, 1)).toBe(1000);
  });
  it("edge: zero volume is guarded (no Infinity)", () => {
    expect(Number.isFinite(density(5, 0))).toBe(true);
  });
  it("invalid: negative volume does not produce NaN", () => {
    expect(Number.isFinite(density(5, -2))).toBe(true);
  });
});

describe("pressure P = F/A", () => {
  it("100 N over 0.5 m² → 200 Pa", () => {
    expect(pressureFromForce(100, 0.5)).toBe(200);
  });
  it("zero area guarded", () => {
    expect(Number.isFinite(pressureFromForce(100, 0))).toBe(true);
  });
});

describe("hydrostatic pressure P = ρgh", () => {
  it("water at 10 m ≈ 98100 Pa", () => {
    expect(close(hydrostaticPressure(1000, 10), 1000 * GRAVITY * 10)).toBe(true);
  });
  it("doubling depth doubles pressure", () => {
    expect(close(hydrostaticPressure(1000, 20), 2 * hydrostaticPressure(1000, 10))).toBe(true);
  });
  it("negative depth clamped to 0", () => {
    expect(hydrostaticPressure(1000, -5)).toBe(0);
  });
  it("custom g is honored", () => {
    expect(close(hydrostaticPressure(1000, 10, 9.81), 98100)).toBe(true);
  });
});

describe("buoyant force Fb = ρgV", () => {
  it("0.002 m³ in water ≈ 19.62 N", () => {
    expect(close(buoyantForce(1000, 0.002), 1000 * GRAVITY * 0.002)).toBe(true);
  });
  it("negative displaced volume clamped to 0", () => {
    expect(buoyantForce(1000, -1)).toBe(0);
  });
});

describe("weight W = mg", () => {
  it("10 kg → ~98.1 N", () => {
    expect(close(weight(10), 98.1)).toBe(true);
  });
});

describe("continuity Q = AV and A1V1 = A2V2", () => {
  it("flow rate 0.1 m² × 2 m/s = 0.2 m³/s", () => {
    expect(close(flowRate(0.1, 2), 0.2)).toBe(true);
  });
  it("halving area doubles velocity", () => {
    expect(close(continuityVelocity(0.3, 1.5, 0.15), 3)).toBe(true);
  });
  it("equal areas keep velocity", () => {
    expect(close(continuityVelocity(0.3, 1.5, 0.3), 1.5)).toBe(true);
  });
  it("zero throat area guarded (finite)", () => {
    expect(Number.isFinite(continuityVelocity(0.3, 1.5, 0))).toBe(true);
  });
});

describe("circle area from diameter", () => {
  it("d = 2 → π", () => {
    expect(close(circleArea(2), Math.PI)).toBe(true);
  });
  it("scales with d²", () => {
    expect(close(circleArea(4), 4 * circleArea(2))).toBe(true);
  });
});

describe("Bernoulli pressure along a streamline", () => {
  it("faster downstream → lower pressure (horizontal)", () => {
    const p2 = bernoulliPressure(20000, 1000, 2, 6, 0, 0);
    expect(p2).toBeLessThan(20000);
  });
  it("equal velocity & elevation → unchanged pressure", () => {
    expect(close(bernoulliPressure(20000, 1000, 3, 3, 1, 1), 20000)).toBe(true);
  });
  it("matches ½ρ(V1²−V2²) for horizontal flow", () => {
    const p1 = 20000;
    const got = bernoulliPressure(p1, 1000, 2, 6, 0, 0);
    expect(close(got, p1 + 0.5 * 1000 * (4 - 36))).toBe(true);
  });
});

describe("energy heads", () => {
  it("pressure head P/ρg", () => {
    expect(close(pressureHead(98100, 1000), 10)).toBe(true);
  });
  it("velocity head V²/2g", () => {
    expect(close(velocityHead(10), 100 / (2 * GRAVITY))).toBe(true);
  });
});

describe("Reynolds number & regime", () => {
  it("Re = ρVD/μ — water example ≈ 50000", () => {
    expect(close(reynoldsNumber(1000, 1, 0.05, 0.001), 50000)).toBe(true);
  });
  it("doubling velocity doubles Re", () => {
    expect(close(reynoldsNumber(1000, 2, 0.05, 0.001), 2 * reynoldsNumber(1000, 1, 0.05, 0.001))).toBe(true);
  });
  it("higher viscosity lowers Re", () => {
    expect(reynoldsNumber(1000, 1, 0.05, 0.1)).toBeLessThan(reynoldsNumber(1000, 1, 0.05, 0.001));
  });
  it("zero viscosity guarded (finite)", () => {
    expect(Number.isFinite(reynoldsNumber(1000, 1, 0.05, 0))).toBe(true);
  });
  it("regime thresholds: <2300 laminar, 2300–4000 transitional, >4000 turbulent", () => {
    expect(flowRegime(1000)).toBe("laminar");
    expect(flowRegime(3000)).toBe("transitional");
    expect(flowRegime(50000)).toBe("turbulent");
    expect(flowRegime(2299)).toBe("laminar");
    expect(flowRegime(4001)).toBe("turbulent");
  });
});

describe("head loss", () => {
  it("major loss hf = f(L/D)(V²/2g)", () => {
    const hf = majorHeadLoss(0.02, 100, 0.1, 2);
    expect(close(hf, 0.02 * (100 / 0.1) * velocityHead(2))).toBe(true);
  });
  it("major loss scales with V² (double V → 4×)", () => {
    const a = majorHeadLoss(0.02, 100, 0.1, 2);
    const b = majorHeadLoss(0.02, 100, 0.1, 4);
    expect(close(b, 4 * a)).toBe(true);
  });
  it("minor loss hm = K(V²/2g)", () => {
    expect(close(minorHeadLoss(1.5, 3), 1.5 * velocityHead(3))).toBe(true);
  });
  it("smaller diameter increases major loss", () => {
    expect(majorHeadLoss(0.02, 100, 0.05, 2)).toBeGreaterThan(majorHeadLoss(0.02, 100, 0.1, 2));
  });
});

describe("vortex tangential speed v = ωr", () => {
  it("solid-body rotation grows with radius", () => {
    expect(close(vortexTangentialSpeed(2, 3), 6)).toBe(true);
  });
});
