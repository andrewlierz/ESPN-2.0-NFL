import Link from "next/link";
import { fmtValue } from "@/lib/format";

export interface HeatRow {
  key: string;
  name: string;
  href?: string;
  pos: string;
  total: number;
  share: number | null;
  cells: (number | null)[]; // pct 0..1 per column, null = no snaps that week
  counts: (number | null)[];
}

const STEPS = 7;

function step(p: number) {
  return Math.max(0, Math.min(STEPS - 1, Math.round(p * (STEPS - 1))));
}

/** Weekly snap-share matrix: one sequential hue, light (low) to dark (high). */
export function SnapHeatmap({ columns, rows, unit }: { columns: string[]; rows: HeatRow[]; unit: string }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="tabular w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted">
              <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-semibold">Player</th>
              <th className="px-1 py-1 text-left font-semibold">Pos</th>
              {columns.map((c) => (
                <th key={c} className="min-w-9 px-1 py-1 text-center font-semibold">
                  {c}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-semibold">{unit}</th>
              <th className="px-2 py-1 text-right font-semibold">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="sticky left-0 z-[1] max-w-44 truncate bg-card px-2 py-1 font-medium text-ink">
                  {r.href ? (
                    <Link href={r.href} className="hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-1 py-1 text-muted">{r.pos}</td>
                {r.cells.map((p, i) => {
                  if (p === null) {
                    return (
                      <td key={i} className="rounded-[3px] px-1 py-1 text-center text-muted" title={`${columns[i]}: no snaps`}>
                        ·
                      </td>
                    );
                  }
                  const s = step(p);
                  return (
                    <td
                      key={i}
                      className="rounded-[3px] px-1 py-1 text-center font-semibold"
                      style={{ background: `var(--seq-${s})`, color: s >= 4 ? "#ffffff" : "var(--ink)" }}
                      title={`${columns[i]}: ${r.counts[i]} snaps (${fmtValue(p, "pct")})`}
                    >
                      {Math.round(p * 100)}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right font-semibold text-ink">{r.total}</td>
                <td className="px-2 py-1 text-right text-ink-2">{fmtValue(r.share, "pct")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted" aria-hidden>
        <span>Snap share</span>
        <span>0%</span>
        <span className="flex overflow-hidden rounded-sm">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} className="h-3 w-5" style={{ background: `var(--seq-${i})` }} />
          ))}
        </span>
        <span>100%</span>
        <span className="ml-2">· = did not play that week</span>
      </div>
    </div>
  );
}
