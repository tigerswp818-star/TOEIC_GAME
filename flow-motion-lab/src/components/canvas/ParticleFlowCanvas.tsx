import { useEffect, useRef, useState } from "react";
import { useRaf } from "@/hooks/useRaf";
import { clamp } from "@/lib/math";

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
  /** Show zoom/pan controls (off for tiny dashboard previews). Default true. */
  zoomable?: boolean;
}

const ZMIN = 1;
const ZMAX = 5;

/**
 * Generic high-DPI canvas host that runs a requestAnimationFrame loop and hands
 * each frame to a `draw` callback. Built-in zoom + pan (buttons, wheel, drag)
 * so every simulation can be magnified — crisp, via a context transform.
 */
export default function ParticleFlowCanvas({
  draw,
  playing,
  speed,
  theme,
  className,
  ariaLabel,
  zoomable = true,
}: ParticleFlowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // View transform (zoom + pan), kept in a ref for the RAF and mirrored to
  // state so the zoom buttons re-render.
  const viewRef = useRef({ zoom: 1, x: 0, y: 0 });
  const [zoomLabel, setZoomLabel] = useState(1);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({ active: false, sx: 0, sy: 0, px: 0, py: 0 });

  const drawRef = useRef(draw);
  drawRef.current = draw;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const setView = (v: { zoom: number; x: number; y: number }) => {
    const zoom = clamp(v.zoom, ZMIN, ZMAX);
    const x = zoom <= 1.001 ? 0 : v.x;
    const y = zoom <= 1.001 ? 0 : v.y;
    viewRef.current = { zoom, x, y };
    setZoomLabel(zoom);
  };

  // Resize the backing store to match the container at device pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = wrapRef.current;
    if (!canvas || !parent) return;
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

  // Non-passive wheel listener so we can zoom with the scroll wheel.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      // Only hijack the wheel for zoom on Ctrl/⌘ (also trackpad pinch) or when
      // already zoomed in — otherwise let the page scroll normally.
      if (!e.ctrlKey && !e.metaKey && viewRef.current.zoom <= 1.001) return;
      e.preventDefault();
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView({ zoom: v.zoom * factor, x: v.x, y: v.y });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useRaf((dt, elapsed) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    const v = viewRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (v.zoom !== 1 || v.x !== 0 || v.y !== 0) {
      ctx.translate(v.x, v.y);
      ctx.translate(w / 2, h / 2);
      ctx.scale(v.zoom, v.zoom);
      ctx.translate(-w / 2, -h / 2);
    }

    drawRef.current({
      ctx,
      width: w,
      height: h,
      dt: dt * speedRef.current,
      time: elapsed,
      theme: themeRef.current,
    });
  }, playing);

  // pan via drag (only when zoomed in)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomable || viewRef.current.zoom <= 1.001) return;
    const v = viewRef.current;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: v.x, py: v.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    setView({ zoom: viewRef.current.zoom, x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
  };
  const onPointerUp = () => { dragRef.current.active = false; };

  const zoomed = zoomLabel > 1.001;
  const btn = "grid h-7 w-7 place-items-center rounded-lg border border-white/15 bg-surface-raised/80 text-sm font-bold text-ink shadow-glass backdrop-blur transition hover:bg-surface-raised active:scale-95 disabled:opacity-40";

  return (
    <div
      ref={wrapRef}
      className={`relative ${className ?? ""}`}
      style={{ cursor: zoomed ? (dragRef.current.active ? "grabbing" : "grab") : "default", touchAction: zoomed ? "none" : "auto" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onDoubleClick={zoomable ? () => setView({ zoom: viewRef.current.zoom >= ZMAX - 0.01 ? 1 : viewRef.current.zoom + 1, x: viewRef.current.x, y: viewRef.current.y }) : undefined}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={ariaLabel ?? "ภาพจำลองการไหลของของไหล"}
      />
      {/* zoom controls */}
      {zoomable && (
      <div className="absolute bottom-2 left-2 z-20 flex flex-col gap-1" aria-hidden>
        <button type="button" className={btn} title="ขยาย (zoom in)" onClick={() => setView({ zoom: viewRef.current.zoom * 1.3, x: viewRef.current.x, y: viewRef.current.y })}>＋</button>
        <button type="button" className={btn} title="ย่อ (zoom out)" onClick={() => setView({ zoom: viewRef.current.zoom / 1.3, x: viewRef.current.x, y: viewRef.current.y })} disabled={!zoomed}>－</button>
        <button type="button" className={`${btn} !text-[9px]`} title="รีเซ็ต (reset)" onClick={() => setView({ zoom: 1, x: 0, y: 0 })} disabled={!zoomed}>{Math.round(zoomLabel * 100)}%</button>
      </div>
      )}
    </div>
  );
}
