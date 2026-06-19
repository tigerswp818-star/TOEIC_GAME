import { useEffect, useRef } from "react";
import { useRaf } from "@/hooks/useRaf";

/** Everything a per-frame draw routine needs. Coordinates are in CSS pixels. */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds advanced this frame, already scaled by playback speed (0 = paused). */
  dt: number;
  /** Total running seconds (excludes paused time). */
  time: number;
  theme: "light" | "dark";
}

interface ParticleFlowCanvasProps {
  /** Called every animation frame. Keep it pure of React state writes. */
  draw: (c: DrawContext) => void;
  /** Playback active (false → dt is 0, scene holds still but stays crisp). */
  playing: boolean;
  /** Playback speed multiplier (0.25 / 0.5 / 1 / 2). */
  speed: number;
  theme: "light" | "dark";
  className?: string;
  /** Aria label describing the live animation for assistive tech. */
  ariaLabel?: string;
}

/**
 * Generic high-DPI canvas host that runs a requestAnimationFrame loop and hands
 * each frame to a `draw` callback. Used by every simulation as the stage for
 * fluid particles, streamlines, vectors and pressure maps.
 */
export default function ParticleFlowCanvas({
  draw,
  playing,
  speed,
  theme,
  className,
  ariaLabel,
}: ParticleFlowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // Keep the latest draw closure without restarting the RAF loop.
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Resize the backing store to match the container at device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  useRaf((dt, elapsed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawRef.current({
      ctx,
      width: w,
      height: h,
      dt: dt * speedRef.current,
      time: elapsed,
      theme: themeRef.current,
    });
  }, playing);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={ariaLabel ?? "ภาพจำลองการไหลของของไหล"}
    />
  );
}
