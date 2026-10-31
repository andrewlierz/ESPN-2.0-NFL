import Link from "next/link";
import { Suspense } from "react";
import { SITE_NAME } from "@/lib/config";
import { NavLinks } from "./NavLinks";
import { PlayerSearch } from "./PlayerSearch";
import { ScoreStrip } from "./ScoreStrip";

export function Header() {
  return (
    <header className="bg-nav text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2" aria-label={`${SITE_NAME} home`}>
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-black italic">G</span>
          <span className="text-lg font-black uppercase italic tracking-tight">{SITE_NAME}</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white/80">NFL</span>
        </Link>
        <NavLinks />
        <div className="ml-auto w-full sm:w-auto">
          <PlayerSearch />
        </div>
      </div>
      <div className="border-t border-white/10 bg-nav">
        <Suspense fallback={<div className="h-[76px]" />}>
          <ScoreStrip />
        </Suspense>
      </div>
    </header>
  );
}
