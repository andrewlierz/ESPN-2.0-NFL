"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

interface Hit {
  id: string;
  name: string;
  team: string;
  pos: string;
  headshot: string;
}

export function PlayerSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setHits(await res.json());
          setActive(0);
          setOpen(true);
        }
      } catch {
        /* aborted */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    router.push(`/players/${h.id}`);
  };

  return (
    <div ref={box} className="relative w-full sm:w-64">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search players"
        aria-label="Search players"
        role="combobox"
        aria-expanded={open}
        aria-controls="player-search-list"
        className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
      />
      {open && hits.length > 0 && (
        <ul
          id="player-search-list"
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-96 w-full min-w-64 overflow-auto rounded-md border border-line bg-card py-1 shadow-lg"
        >
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? "bg-card-2" : ""}`}
              >
                {h.headshot ? (
                  <img src={h.headshot} alt="" className="h-7 w-7 rounded-full bg-card-2 object-cover object-top" />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-card-2" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{h.name}</span>
                <span className="text-xs text-muted">
                  {h.pos} · {h.team}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
