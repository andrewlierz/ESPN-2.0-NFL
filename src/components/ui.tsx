import Link from "next/link";
import type { ReactNode } from "react";
import { getTeam } from "@/lib/teams";

/* eslint-disable @next/next/no-img-element */

export function TeamLogo({ team, size = 24, className = "" }: { team: string; size?: number; className?: string }) {
  const t = getTeam(team);
  if (!t) return <span style={{ width: size, height: size }} className={`inline-block ${className}`} />;
  return (
    <img
      src={t.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function TeamLink({ team, season, full = false, className = "" }: { team: string; season?: number; full?: boolean; className?: string }) {
  const t = getTeam(team);
  const href = `/teams/${team}${season ? `?season=${season}` : ""}`;
  return (
    <Link href={href} className={`inline-flex items-center gap-2 hover:underline ${className}`}>
      <TeamLogo team={team} size={20} />
      <span>{full ? (t?.name ?? team) : team}</span>
    </Link>
  );
}

export function Headshot({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  if (!src) {
    const initials = name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("");
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-card-2 text-xs font-semibold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-card-2 object-cover object-top"
      style={{ width: size, height: size }}
    />
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
  pad = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`rounded-lg border border-line bg-card shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title && <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h2>}
          {action && <div className="text-xs font-medium text-link">{action}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StatTile({ label, value, sub, title }: { label: string; value: ReactNode; sub?: ReactNode; title?: string }) {
  return (
    <div className="rounded-md border border-line bg-card-2 px-3 py-2.5" title={title}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-ink">{value}</div>
      {sub && <div className="text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" | "good" | "bad" }) {
  const cls =
    tone === "live"
      ? "bg-live text-white"
      : tone === "good"
        ? "bg-good/15 text-good"
        : tone === "bad"
          ? "bg-bad/15 text-bad"
          : "bg-card-2 text-ink-2 border border-line";
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>;
}

/** Simple static table for small, non-sortable data. */
export function SimpleTable({
  head,
  rows,
  align,
  className = "",
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  align?: ("l" | "r" | "c")[];
  className?: string;
}) {
  const a = (i: number) => (align?.[i] === "l" ? "text-left" : align?.[i] === "c" ? "text-center" : i === 0 ? "text-left" : "text-right");
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            {head.map((h, i) => (
              <th key={i} className={`whitespace-nowrap px-2 py-1.5 font-semibold ${a(i)}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line/70 last:border-0 hover:bg-card-2">
              {r.map((cell, ci) => (
                <td key={ci} className={`whitespace-nowrap px-2 py-1.5 ${a(ci)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
