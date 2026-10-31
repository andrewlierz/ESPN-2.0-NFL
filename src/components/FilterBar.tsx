"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
}

/**
 * A row of selects that write to the URL query string. Changing one control
 * navigates immediately; the server re-renders with the new filters.
 */
export function FilterBar({ filters, reset }: { filters: FilterDef[]; reset?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    // Changing season resets week-range filters that may not exist there.
    if (name === "season") for (const r of reset ?? []) next.delete(r);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className={`flex flex-wrap items-end gap-2 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      {filters.map((f) => (
        <label key={f.name} className="flex flex-col gap-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {f.label}
          <select
            value={f.value}
            onChange={(e) => update(f.name, e.target.value)}
            className="min-w-24 rounded-md border border-line bg-card px-2 py-1.5 text-sm font-medium normal-case tracking-normal text-ink focus:border-series-1 focus:outline-none"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {pending && <span className="pb-2 text-xs text-muted">Loading…</span>}
    </div>
  );
}
