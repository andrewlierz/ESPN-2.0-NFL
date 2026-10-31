"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/scores", label: "Scores" },
  { href: "/standings", label: "Standings" },
  { href: "/stats", label: "Stats" },
  { href: "/teams", label: "Teams" },
  { href: "/glossary", label: "Glossary" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="no-scrollbar -mx-1 flex overflow-x-auto">
      {LINKS.map((l) => {
        const on = l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/scores" && path.startsWith("/games"));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-semibold transition-colors ${
              on ? "bg-white/15 text-white" : "text-white/75 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
