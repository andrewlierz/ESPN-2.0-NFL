"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtValue } from "@/lib/format";
import type { CellValue, Column, Entity, TableRow } from "@/lib/table";

/* eslint-disable @next/next/no-img-element */

const LOGO = (team: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${team === "LA" ? "lar" : team === "WAS" ? "wsh" : team.toLowerCase()}.png`;

function EntityCell({ e, season }: { e: Entity; season?: number }) {
  const q = season ? `?season=${season}` : "";
  if (e.kind === "team") {
    return (
      <Link href={`/teams/${e.team}${q}`} className="flex items-center gap-2 font-semibold text-ink hover:underline">
        <img src={LOGO(e.team)} alt="" width={20} height={20} loading="lazy" className="h-5 w-5 object-contain" />
        {e.team}
      </Link>
    );
  }
  const name = e.id ? (
    <Link href={`/players/${e.id}${q}`} className="font-semibold text-ink hover:underline">
      {e.name}
    </Link>
  ) : (
    <span className="font-semibold text-ink">{e.name}</span>
  );
  return (
    <div className="flex items-center gap-2">
      {e.headshot ? (
        <img src={e.headshot} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded-full bg-card-2 object-cover object-top" />
      ) : (
        <span className="h-7 w-7 shrink-0 rounded-full bg-card-2" aria-hidden />
      )}
      <div className="min-w-0 leading-tight">
        <div className="truncate">{name}</div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <img src={LOGO(e.team)} alt="" width={12} height={12} loading="lazy" className="h-3 w-3 object-contain" />
          {e.team}
          {e.pos ? ` · ${e.pos}` : ""}
        </div>
      </div>
    </div>
  );
}

function compare(a: CellValue | undefined, b: CellValue | undefined, asc: boolean): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an && bn) return 0;
  if (an) return 1; // nulls always last
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return asc ? a - b : b - a;
  return asc ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
}

export function DataTable({
  columns,
  rows,
  defaultSort,
  defaultAsc = false,
  pageSize = 50,
  searchable = true,
  season,
  entityLabel = "Player",
  dense = false,
}: {
  columns: Column[];
  rows: TableRow[];
  defaultSort: string;
  defaultAsc?: boolean;
  pageSize?: number;
  searchable?: boolean;
  season?: number;
  entityLabel?: string;
  dense?: boolean;
}) {
  const [sortKey, setSortKey] = useState(defaultSort);
  const [asc, setAsc] = useState(defaultAsc);
  const [limit, setLimit] = useState(pageSize);
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => {
          const e = r.entity;
          const hay = e.kind === "player" ? `${e.name} ${e.team} ${e.pos ?? ""}` : e.team;
          return hay.toLowerCase().includes(q);
        })
      : rows;
    return [...filtered].sort((a, b) => compare(a.v[sortKey], b.v[sortKey], asc));
  }, [rows, sortKey, asc, query]);

  const onSort = (c: Column) => {
    if (c.key === sortKey) setAsc(!asc);
    else {
      setSortKey(c.key);
      setAsc(!!c.asc);
    }
  };

  const visible = sorted.slice(0, limit);
  const py = dense ? "py-1" : "py-1.5";

  return (
    <div>
      {searchable && rows.length > 15 && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(pageSize);
            }}
            placeholder={`Filter ${rows.length} ${entityLabel.toLowerCase()}s…`}
            className="w-full max-w-xs rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-series-1 focus:outline-none"
            aria-label={`Filter ${entityLabel.toLowerCase()}s`}
          />
          <span className="text-xs text-muted">Click a column to sort</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="tabular w-full border-collapse text-sm">
          <thead className="bg-card-2">
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className={`sticky left-0 z-10 bg-card-2 px-2 ${py} text-left font-semibold`}>#</th>
              <th className={`sticky left-8 z-10 bg-card-2 px-2 ${py} text-left font-semibold`}>{entityLabel}</th>
              {columns.map((c) => {
                const on = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    aria-sort={on ? (asc ? "ascending" : "descending") : "none"}
                    className={`whitespace-nowrap px-2 ${py} text-right font-semibold`}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(c)}
                      title={c.title}
                      className={`inline-flex items-center gap-0.5 uppercase hover:text-ink ${on ? "text-ink" : ""} ${c.title ? "cursor-help underline decoration-dotted decoration-1 underline-offset-2" : ""}`}
                    >
                      {c.label}
                      <span aria-hidden className="w-2 text-[9px]">{on ? (asc ? "▲" : "▼") : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className="group border-t border-line hover:bg-card-2">
                <td className={`sticky left-0 z-[1] w-8 bg-card px-2 ${py} text-xs text-muted group-hover:bg-card-2`}>{i + 1}</td>
                <td className={`sticky left-8 z-[1] min-w-44 max-w-56 bg-card px-2 ${py} group-hover:bg-card-2`}>
                  <EntityCell e={r.entity} season={season} />
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-2 ${py} text-right ${c.key === sortKey ? "bg-series-1/5 font-semibold text-ink" : "text-ink-2"}`}
                  >
                    {fmtValue(r.v[c.key], c.fmt)}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length + 2} className="px-2 py-8 text-center text-sm text-muted">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setLimit(limit + pageSize)}
            className="rounded-md border border-line bg-card px-4 py-1.5 text-sm font-semibold text-ink hover:bg-card-2"
          >
            Show more ({sorted.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
