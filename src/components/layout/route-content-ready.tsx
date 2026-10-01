"use client";

import { useEffect } from "react";
import { TAB_CONTENT_READY, tabIndex } from "@/lib/tab-navigation-timing";

/** Marks committed primary route content, not loading fallbacks or optional streamed panels. */
export function RouteContentReady({ path }: { path: string }) {
  useEffect(() => {
    const tab = tabIndex(path);
    if (tab < 0) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(TAB_CONTENT_READY, { detail: tab })));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [path]);
  return null;
}
