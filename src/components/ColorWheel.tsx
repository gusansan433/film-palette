"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { hsvToRgb, rgbToHex, rgbToHsv } from "@/lib/colors";

type ColorWheelProps = {
  onPick: (color: { r: number; g: number; b: number } | null) => void;
};

type HSV = { h: number; s: number; v: number };

function toRgb(hsv: HSV) {
  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return { r, g, b };
}

function hueFromPoint(x: number, y: number) {
  return (((Math.atan2(y, x) * 180) / Math.PI + 90) + 360) % 360;
}

function drawDisc(canvas: HTMLCanvasElement, value: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = canvas.clientWidth || 180;
  canvas.width = Math.round(css * dpr);
  canvas.height = Math.round(css * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 1;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const index = (y * size + x) * 4;
      if (dist > outer) {
        data[index + 3] = 0;
        continue;
      }
      const [r, g, b] = hsvToRgb(hueFromPoint(dx, dy), dist / outer, value);
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function ColorWheel({ onPick }: ColorWheelProps) {
  const discRef = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<HSV | null>(null);
  const rgb = hsv ? toRgb(hsv) : null;
  const hex = rgb ? rgbToHex(rgb.r, rgb.g, rgb.b).toUpperCase() : null;
  const hueColor = `hsl(${hsv?.h ?? 0} 100% 50%)`;
  const value = hsv?.v ?? 1;

  useEffect(() => {
    const canvas = discRef.current;
    if (!canvas) return;
    const paint = () => drawDisc(canvas, value);
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [value]);

  function commit(next: HSV) {
    setHsv(next);
    onPick(toRgb(next));
  }

  function pickDisc(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const dist = Math.hypot(x, y);
    const outer = bounds.width / 2;
    if (dist > outer) return;
    commit({
      h: hueFromPoint(x, y),
      s: Math.min(dist / outer, 1),
      v: hsv?.v ?? 1,
    });
  }

  function pickSquare(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const s = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    const v = 1 - Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
    commit({ h: hsv?.h ?? 0, s, v });
  }

  function drag(
    event: PointerEvent<HTMLDivElement>,
    pick: (event: PointerEvent<HTMLDivElement>) => void,
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pick(event);
  }

  function slide(channel: "r" | "g" | "b", value: number) {
    const current = rgb ?? { r: 128, g: 128, b: 128 };
    const next = { ...current, [channel]: value };
    commit(rgbToHsv(next.r, next.g, next.b));
  }

  function clear() {
    setHsv(null);
    onPick(null);
  }

  return (
    <div>
      <h2 className="text-xs tracking-[0.24em] text-[var(--muted)]">颜色区块</h2>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div
          className="relative aspect-square w-[min(180px,42vw)] shrink-0 cursor-crosshair"
          onPointerDown={(event) => drag(event, pickDisc)}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            pickDisc(event);
          }}
        >
          <canvas ref={discRef} className="h-full w-full rounded-full" />
          {hsv && (
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
              style={{
                left: `${50 + Math.cos(((hsv.h - 90) * Math.PI) / 180) * hsv.s * 50}%`,
                top: `${50 + Math.sin(((hsv.h - 90) * Math.PI) / 180) * hsv.s * 50}%`,
                background: hex ?? "transparent",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              }}
            />
          )}
        </div>

        <div
          className="relative aspect-square w-[min(180px,42vw)] shrink-0 cursor-crosshair overflow-hidden rounded-md"
          onPointerDown={(event) => drag(event, pickSquare)}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            pickSquare(event);
          }}
          style={{
            background: `
              linear-gradient(to bottom, transparent, #000),
              linear-gradient(to right, #fff, ${hueColor})
            `,
          }}
        >
          {hsv && (
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: hex ?? "transparent",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              }}
            />
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-[11px] tracking-[0.18em] text-[var(--muted)]">RGB</p>
        <Channel
          label="红"
          value={rgb?.r ?? 0}
          color="#ff4d4d"
          gradient={`linear-gradient(90deg, rgb(0 ${rgb?.g ?? 0} ${rgb?.b ?? 0}), rgb(255 ${rgb?.g ?? 0} ${rgb?.b ?? 0}))`}
          onChange={(value) => slide("r", value)}
        />
        <Channel
          label="绿"
          value={rgb?.g ?? 0}
          color="#3dff7a"
          gradient={`linear-gradient(90deg, rgb(${rgb?.r ?? 0} 0 ${rgb?.b ?? 0}), rgb(${rgb?.r ?? 0} 255 ${rgb?.b ?? 0}))`}
          onChange={(value) => slide("g", value)}
        />
        <Channel
          label="蓝"
          value={rgb?.b ?? 0}
          color="#4db8ff"
          gradient={`linear-gradient(90deg, rgb(${rgb?.r ?? 0} ${rgb?.g ?? 0} 0), rgb(${rgb?.r ?? 0} ${rgb?.g ?? 0} 255))`}
          onChange={(value) => slide("b", value)}
        />
      </div>

      <div className="mt-4 flex items-center gap-3 text-[var(--acid)]">
        {hex && rgb ? (
          <>
            <span className="font-mono text-sm tracking-wide">{hex}</span>
            <span
              className="h-8 w-8 shrink-0 rounded-sm border border-[var(--acid)]/40"
              style={{ background: hex }}
              aria-label={hex}
            />
            <button
              type="button"
              onClick={clear}
              className="text-[11px] tracking-wide text-[var(--muted)] underline decoration-[var(--line)]"
            >
              显示全部
            </button>
          </>
        ) : (
          <span className="text-sm text-[var(--muted)]">点色环或方块取色</span>
        )}
      </div>
    </div>
  );
}

function Channel({
  label,
  value,
  color,
  gradient,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  gradient: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px]" style={{ color }}>
        <span>{label}</span>
        <span className="font-mono text-[var(--paper)]">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="channel-slider h-8 w-full sm:h-auto"
        style={{ background: gradient }}
      />
    </label>
  );
}
