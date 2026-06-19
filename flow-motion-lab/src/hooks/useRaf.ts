import { useEffect, useRef } from "react";

/**
 * requestAnimationFrame loop with a delta-time callback.
 *
 * - `callback(dt, elapsed)` receives seconds since the last frame and total
 *   *running* seconds (time spent paused does not accumulate).
 * - When `active` is false the loop keeps running but `dt` is reported as 0,
 *   so consumers can still redraw (e.g. after a slider change) without
 *   advancing the physics. `dt` is also clamped to avoid huge jumps after the
 *   tab was backgrounded.
 */
export function useRaf(
  callback: (dt: number, elapsed: number) => void,
  active = true,
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const activeRef = useRef(active);
  activeRef.current = active;

  const elapsedRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      let dt = (now - last) / 1000;
      last = now;
      // Clamp pathological deltas (tab switch, breakpoints).
      if (dt > 0.1) dt = 0.1;
      const step = activeRef.current ? dt : 0;
      elapsedRef.current += step;
      cbRef.current(step, elapsedRef.current);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}
