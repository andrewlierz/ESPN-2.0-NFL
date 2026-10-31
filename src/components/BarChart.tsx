"use client";

import { useState } from "react";
import { fmtValue } from "@/lib/format";
import type { Fmt } from "@/lib/table";

export interface Bar {
  label: string; // x-axis label, e.g. "W3"
  value: number | null;
  detail?: string; // tooltip line
}

/**
 * Single-series vertical bar chart (one hue, no legend; the title names it).
 * Bars grow from a zero baseline (negative values hang below it) with rounded
 * data-ends and a per-bar hover tooltip.
 */
export function BarChart({
  bars,
  max,
  fmt = "int",
  height = 140,
  ariaLabel,
}: {
  bars: Bar[];
  max?: number;
  fmt?: Fmt;
  height?: number;
  ariaLabel: string;
}) {
  const format = (v: number) => fmtValue(v, fmt);
  const [hover, setHover] = useState<number | null>(null);
  const vals = bars.map((b) => b.value).filter((v): v is number => v !== null);
  const hi = max ?? Math.max(1, ...vals);
  const lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const zero = (0 - lo) / span; // baseline position (0..1 from bottom)
  const pos = (v: number) => (v - lo) / span;
  // Label the floor only when it sits far enough below zero not to collide with the 0 label.
  const ticks = lo < 0 ? (zero > 0.15 ? [lo, 0, hi] : [0, hi]) : [0, hi / 2, hi];
  const n = bars.length || 1;
  const W = 100 / n;

  return (
    <div className="relative select-none pl-9" role="group" aria-label={ariaLabel}>
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div
            key={t}
            className={`absolute inset-x-0 border-t ${t === 0 ? "border-line-strong" : "border-line"}`}
            style={{ bottom: `${pos(t) * 100}%` }}
          >
            <span className="absolute -top-2 right-full mr-1 text-[10px] text-muted tabular">{format(t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex">
          {bars.map((b, i) => {
            const v = b.value;
            const neg = v !== null && v < 0;
            const h = v === null ? 0 : Math.min(1, Math.abs(v) / span);
            return (
              <div
                key={i}
                className="relative h-full"
                style={{ width: `${W}%` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${b.label}: ${v === null ? "did not play" : format(v)}`}
              >
                {v === null ? (
                  <span className="absolute inset-x-0 text-center text-[10px] text-muted" style={{ bottom: `${zero * 100}%` }}>
                    –
                  </span>
                ) : (
                  <div
                    className={`absolute left-1/2 w-[62%] max-w-7 -translate-x-1/2 transition-opacity ${neg ? "rounded-b-[4px]" : "rounded-t-[4px]"} ${hover !== null && hover !== i ? "opacity-50" : ""}`}
                    style={{
                      bottom: `${(neg ? zero - h : zero) * 100}%`,
                      height: `${h * 100}%`,
                      minHeight: v !== 0 ? 2 : 0,
                      background: "var(--series-1)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        {hover !== null && bars[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-card px-2 py-1 text-xs shadow-md"
            style={{
              left: `${(hover + 0.5) * W}%`,
              bottom: `min(calc(${pos(Math.max(0, bars[hover].value ?? 0)) * 100}% + 6px), calc(100% - 64px))`,
            }}
          >
            <div className="font-semibold text-ink">{bars[hover].label}</div>
            <div className="text-ink-2 tabular">
              {bars[hover].value === null ? "Did not play" : format(bars[hover].value!)}
            </div>
            {bars[hover].detail && <div className="text-muted">{bars[hover].detail}</div>}
          </div>
        )}
      </div>
      <div className="mt-1 flex">
        {bars.map((b, i) => (
          <div key={i} className="text-center text-[10px] text-muted" style={{ width: `${W}%` }}>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
