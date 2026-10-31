"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the current route on an interval while games are live. */
export function AutoRefresh({ active, seconds = 30 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
