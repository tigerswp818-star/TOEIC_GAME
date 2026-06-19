/**
 * Qualitative model for the Converging–Diverging (de Laval) Nozzle simulation
 * (Compressible Flow chapter).
 *
 * ⚠️ SIMPLIFIED EDUCATIONAL MODEL — this is NOT an exact isentropic / area–Mach
 * solver. It produces an *illustrative* Mach profile that captures the essential
 * qualitative behaviour students need to learn:
 *
 *   • A C-D nozzle narrows to a minimum-area THROAT, then widens (diverges).
 *   • At high back-pressure ratio (p_back/p₀) the whole flow stays subsonic and
 *     behaves like a venturi (accelerate to the throat, then decelerate again).
 *   • Below a critical pressure ratio the throat "chokes": the flow reaches
 *     Mach 1 exactly at the throat and cannot speed up there any more.
 *   • Once choked and the back pressure is low enough, the diverging section
 *     accelerates the flow to SUPERSONIC (M > 1).
 *   • At a moderate (but still choking) back pressure a NORMAL SHOCK can stand
 *     in the diverging section, where the flow jumps abruptly back to subsonic.
 *
 * Pure functions only — no rendering, no side effects. The component owns all
 * animation state (the particle ring buffer).
 */
import { clamp, lerp, smoothstep } from "@/lib/math";

/** One particle flowing along the nozzle. */
export interface NozzleParticle {
  /** Normalised horizontal position 0→1 along the nozzle. */
  xf: number;
  /** Streamline fraction in [-0.9, 0.9] (share of local half-height). */
  f: number;
}

/** Normalised x of the throat (minimum area) — centre of the nozzle. */
export const THROAT_XF = 0.5;

/** Inlet / exit sampling positions (normalised). */
export const PLANE_INLET = 0.06;
export const PLANE_EXIT = 0.94;

/**
 * Critical back-pressure ratio at/below which the nozzle chokes. Above this the
 * flow is everywhere subsonic; at/below it the throat reaches Mach 1. Chosen as
 * a clean conceptual threshold (real air ≈ 0.528), not an exact gas value.
 */
export const CHOKE_RATIO = 0.85;

/**
 * Back-pressure ratio below which the (choked) diverging section runs fully
 * supersonic with no normal shock. Between CHOKE_RATIO and this value a shock
 * stands somewhere in the diverging part.
 */
export const SUPERSONIC_RATIO = 0.35;

/**
 * Cross-sectional area (relative) at normalised position xf, given the throat
 * area. The nozzle is widest at the ends (fixed inlet/exit area = 1) and
 * narrowest at the throat (= throatArea). A smooth bowl shape: converging on
 * the left, diverging on the right, minimum at THROAT_XF.
 */
export function areaAt(xf: number, throatArea: number): number {
  const x = clamp(xf, 0, 1);
  // Distance from throat, 0 at throat → 1 at either end.
  const d = Math.abs(x - THROAT_XF) / THROAT_XF;
  // Smooth interpolation from throat (d=0) to ends (d=1).
  return lerp(throatArea, 1, smoothstep(0, 1, clamp(d, 0, 1)));
}

/** True when the back-pressure ratio is low enough to choke the throat. */
export function isChoked(pressureRatio: number): boolean {
  return pressureRatio <= CHOKE_RATIO;
}

/**
 * Position (normalised xf > THROAT_XF) of a standing normal shock in the
 * diverging section, or `null` if there is no shock (subsonic, or fully
 * supersonic exit). The shock sits closer to the throat as the back pressure
 * rises toward the choke point, and moves toward the exit as it falls.
 */
export function shockPosition(pressureRatio: number): number | null {
  if (!isChoked(pressureRatio)) return null; // not choked → no supersonic region → no shock
  if (pressureRatio <= SUPERSONIC_RATIO) return null; // low enough → fully supersonic, shock leaves the nozzle
  // Between SUPERSONIC_RATIO and CHOKE_RATIO: shock stands in the diverging part.
  // Higher back pressure → shock nearer the throat; lower → nearer the exit.
  const t = clamp(
    (CHOKE_RATIO - pressureRatio) / (CHOKE_RATIO - SUPERSONIC_RATIO),
    0,
    1,
  );
  // Map to a position from just after the throat (0.58) to near the exit (0.9).
  return lerp(0.58, 0.9, t);
}

/**
 * Illustrative local Mach number along the nozzle.
 *
 *   • Converging part (xf < throat): subsonic, accelerating toward the throat.
 *   • Throat (xf = throat): M < 1 if not choked, exactly M = 1 if choked.
 *   • Diverging part (xf > throat): decelerates back to subsonic if NOT choked
 *     (venturi-like); if choked, accelerates to supersonic — unless a normal
 *     shock stands there, after which it drops abruptly back to subsonic and
 *     keeps decelerating to the exit.
 *
 * Returns a Mach number ≥ 0. This is a smooth qualitative profile, NOT an exact
 * isentropic area–Mach solution.
 */
export function machAlongNozzle(
  xf: number,
  pressureRatio: number,
  throatArea: number,
): number {
  const x = clamp(xf, 0, 1);
  const choked = isChoked(pressureRatio);

  // Inlet subsonic Mach: a small base value that rises slightly as the nozzle
  // works harder (lower back pressure / tighter throat).
  const throatTighten = clamp((0.8 - throatArea) / 0.6, 0, 1); // 0 wide → 1 tight
  const inletMach = lerp(0.12, 0.32, throatTighten);

  // Throat Mach when NOT choked: subsonic, approaching 1 as we near the choke
  // ratio. The closer p_back/p₀ is to CHOKE_RATIO the closer the throat is to 1.
  const subThroatMach = choked
    ? 1
    : lerp(inletMach + 0.15, 0.97, smoothstep(1, CHOKE_RATIO, pressureRatio));

  if (x <= THROAT_XF) {
    // Converging: accelerate smoothly from inlet to the throat condition.
    const t = smoothstep(PLANE_INLET, THROAT_XF, x);
    return lerp(inletMach, subThroatMach, t);
  }

  // Diverging section.
  const td = smoothstep(THROAT_XF, PLANE_EXIT, x); // 0 at throat → 1 at exit

  if (!choked) {
    // Venturi-like: decelerate back toward the inlet-ish subsonic value.
    return lerp(subThroatMach, inletMach + 0.04, td);
  }

  // Choked: from M=1 at the throat the diverging section keeps accelerating.
  // The "design" supersonic exit Mach grows as the back pressure falls and as
  // the area ratio (exit/throat) grows (tighter throat → more expansion).
  const expansion = clamp((1 - throatArea) , 0, 1); // larger when throat is tight
  const exitMachDesign = lerp(1.15, 2.8, clamp(expansion + (SUPERSONIC_RATIO - pressureRatio + 0.2), 0, 1));
  const supersonic = lerp(1, exitMachDesign, td);

  const shock = shockPosition(pressureRatio);
  if (shock === null) {
    // Fully supersonic diverging section, no shock.
    return supersonic;
  }

  // A normal shock stands at `shock`: supersonic up to it, then an abrupt jump
  // back to subsonic, decelerating gently to the exit.
  if (x < shock) {
    return supersonic;
  }
  // Mach just upstream of the shock; subsonic value downstream is < 1.
  const preShockMach = lerp(1, exitMachDesign, smoothstep(THROAT_XF, PLANE_EXIT, shock));
  const postShockMach = clamp(0.95 / Math.max(preShockMach, 1e-6) + 0.25, 0.25, 0.85);
  const tAfter = smoothstep(shock, PLANE_EXIT, x);
  return lerp(postShockMach, postShockMach * 0.7, tAfter);
}

/** Exit Mach number (at PLANE_EXIT) for the current operating point. */
export function exitMach(pressureRatio: number, throatArea: number): number {
  return machAlongNozzle(PLANE_EXIT, pressureRatio, throatArea);
}

/** Overall flow regime label key for the current operating point. */
export type NozzleRegime = "subsonic" | "choked-shock" | "supersonic";

export function classifyRegime(pressureRatio: number): NozzleRegime {
  if (!isChoked(pressureRatio)) return "subsonic";
  return shockPosition(pressureRatio) === null ? "supersonic" : "choked-shock";
}

/** Thai display label for a regime. */
export function regimeLabelTh(regime: NozzleRegime): string {
  switch (regime) {
    case "subsonic":
      return "ต่ำกว่าเสียงทั้งหมด (Subsonic)";
    case "choked-shock":
      return "Choked + คลื่นกระแทก (Shock)";
    case "supersonic":
      return "เหนือเสียงที่ทางออก (Supersonic)";
  }
}

/** Throat-condition label: subsonic vs choked (sonic, M = 1). */
export function throatConditionTh(pressureRatio: number): string {
  return isChoked(pressureRatio) ? "Choked (M = 1)" : "Subsonic (M < 1)";
}

/**
 * Illustrative static-pressure trend along the nozzle, normalised to [0,1]
 * where 1 = inlet stagnation-ish (high) and lower = faster/lower-pressure.
 * Pressure falls as Mach rises (warm inlet → cool low-pressure region). When a
 * shock stands in the diverging part, pressure jumps back up across it.
 */
export function pressureTrend(
  xf: number,
  pressureRatio: number,
  throatArea: number,
): number {
  const m = machAlongNozzle(xf, pressureRatio, throatArea);
  // Higher Mach → lower normalised pressure. Squared falls off faster, reading
  // as a strong drop where the flow is fastest.
  return clamp(1 / (1 + 0.6 * m * m), 0, 1);
}

/** Illustrative local flow speed proxy ∝ local Mach (used to drive particles). */
export function speedProxy(
  xf: number,
  pressureRatio: number,
  throatArea: number,
): number {
  // Add a small floor so particles never fully stall, and emphasise Mach so the
  // throat/diverging acceleration reads clearly.
  return 0.35 + machAlongNozzle(xf, pressureRatio, throatArea);
}

/** Seed a fresh set of particles spread across the nozzle. */
export function seedParticles(count: number): NozzleParticle[] {
  const out: NozzleParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.9 });
  }
  return out;
}
