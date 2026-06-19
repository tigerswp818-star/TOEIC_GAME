/**
 * Model for the Energy Grade Line (EGL) & Hydraulic Grade Line (HGL)
 * simulation. A pipe is routed left→right through a number of stations with
 * changing elevation z. Along the way a pump adds head (+), a turbine removes
 * head (−) and distributed wall friction removes head gradually (−).
 *
 * Extended Bernoulli along the line gives the TOTAL head H at every station:
 *   H_out = H_in + h_pump − h_turbine − h_loss
 * EGL = total head H; HGL = EGL − velocity head V²/2g. The pump steps the EGL
 * UP; the turbine and friction step it DOWN. The pure velocity-head formula
 * lives in lib/fluidFormulas; the per-station bookkeeping is new here.
 */
import { velocityHead } from "@/lib/fluidFormulas";

export interface FlowParticle {
  /** Normalised horizontal position 0→1 across the pipe. */
  xf: number;
  /** Streamline fraction in [-0.78, 0.78] (share of pipe half-height). */
  f: number;
}

/**
 * The four stations are laid out across the width. The pump sits between
 * stations 0→1 and the turbine between stations 2→3, so the EGL shows a clear
 * step up early and a step down late, with friction sloping it everywhere.
 */
export const STATION_XF = [0.06, 0.36, 0.66, 0.94] as const;
export const STATION_COUNT = STATION_XF.length;

/** Normalised x of the pump glyph (between station 0 and 1). */
export const PUMP_XF = 0.21;
/** Normalised x of the turbine glyph (between station 2 and 3). */
export const TURBINE_XF = 0.8;

/** Relative bed elevation of each station (0..1, multiplied by inlet z range). */
const ELEVATION_PROFILE = [1, 0.45, 0.7, 0.15] as const;

export interface StationHead {
  /** Normalised x position of the station. */
  xf: number;
  /** Bed / pipe-centre elevation z at the station (m). */
  z: number;
  /** Total head = EGL at the station (m). */
  egl: number;
  /** Hydraulic grade line = EGL − V²/2g at the station (m). */
  hgl: number;
}

export interface EglHglResult {
  /** EGL & HGL sampled at every station, left→right. */
  stations: StationHead[];
  /** Velocity head V²/2g (m). */
  vHead: number;
  /** Total head delivered at the outlet (last station EGL, m). */
  outletHead: number;
  /** Pump head added (m). */
  pumpHead: number;
  /** Total head removed by friction + turbine (m). */
  lossTotal: number;
  /** Friction head loss (m). */
  loss: number;
  /** Turbine head removed (m). */
  turbine: number;
  /** EGL value at the inlet (station 0, m). */
  inletHead: number;
}

/**
 * Compute EGL and HGL at every station from the live parameters.
 *
 * The total head starts at the inlet (z0 + velocity head, taking inlet gauge
 * pressure head as 0). Walking left→right we add the pump's head once, then
 * remove the turbine's head once, and bleed off friction uniformly across the
 * remaining span. HGL trails EGL by the (constant) velocity head V²/2g.
 */
export function computeEglHgl(
  z0: number,
  V: number,
  hPump: number,
  hTurbine: number,
  hLoss: number,
): EglHglResult {
  const vHead = velocityHead(V);

  // Per-station bed elevation: anchor station 0 at z0, scale the rest of the
  // profile around it so changes are visible but stay near the inlet level.
  const zAt = (i: number): number => {
    const base = ELEVATION_PROFILE[i] ?? ELEVATION_PROFILE[ELEVATION_PROFILE.length - 1];
    // Map profile so station 0 == z0; spread of ±~40% of z0 (min 1.5 m).
    const spread = Math.max(1.5, z0 * 0.6);
    return z0 + (base - ELEVATION_PROFILE[0]) * spread;
  };

  // Friction is shared across the three inter-station spans.
  const lossPerSpan = hLoss / (STATION_COUNT - 1);

  const stations: StationHead[] = [];
  let egl = z0 + vHead; // inlet total head (gauge pressure head taken as 0)
  const inletHead = egl;

  for (let i = 0; i < STATION_COUNT; i++) {
    // Apply the discrete pump/turbine events on the span ENTERING this station.
    if (i > 0) {
      egl -= lossPerSpan; // friction over the span
      if (i === 1) egl += hPump; // pump added on span 0→1
      if (i === 3) egl -= hTurbine; // turbine removed on span 2→3
    }
    const z = zAt(i);
    stations.push({ xf: STATION_XF[i], z, egl, hgl: egl - vHead });
  }

  const outletHead = stations[stations.length - 1].egl;

  return {
    stations,
    vHead,
    outletHead,
    pumpHead: hPump,
    lossTotal: hLoss + hTurbine,
    loss: hLoss,
    turbine: hTurbine,
    inletHead,
  };
}

/** Seed a fresh set of particles spread across the pipe. */
export function seedParticles(count: number): FlowParticle[] {
  const out: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ xf: Math.random(), f: (Math.random() * 2 - 1) * 0.78 });
  }
  return out;
}
