import { useCallback, useState } from "react";
import { DEFAULT_TOGGLES, type ToggleKey, type VizToggles } from "@/types/simulation";

export interface SimControls {
  playing: boolean;
  speed: number;
  toggles: VizToggles;
  /** Increments on every reset so canvases can re-seed their particles. */
  resetNonce: number;
  setPlaying: (v: boolean) => void;
  togglePlay: () => void;
  setSpeed: (s: number) => void;
  setToggle: (key: ToggleKey, value: boolean) => void;
  reset: () => void;
}

/**
 * Central playback + visualisation state for a simulation:
 * play/pause, speed (0.25/0.5/1/2), reset, and layer toggles.
 *
 * `initialToggles` lets a sim start with only the layers it supports enabled.
 */
export function useSimControls(initialToggles?: Partial<VizToggles>): SimControls {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [resetNonce, setResetNonce] = useState(0);
  const [toggles, setToggles] = useState<VizToggles>({
    ...DEFAULT_TOGGLES,
    ...initialToggles,
  });

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const setToggle = useCallback(
    (key: ToggleKey, value: boolean) =>
      setToggles((t) => ({ ...t, [key]: value })),
    [],
  );
  const reset = useCallback(() => {
    setResetNonce((n) => n + 1);
    setPlaying(true);
    setSpeed(1);
  }, []);

  return {
    playing,
    speed,
    toggles,
    resetNonce,
    setPlaying,
    togglePlay,
    setSpeed,
    setToggle,
    reset,
  };
}
