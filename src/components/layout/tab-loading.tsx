"use client";

import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

const labels: Record<string, string> = { "/": "Today", "/history": "History", "/challenges": "Challenges", "/friends": "Friends", "/profile": "Profile", "/feed": "Friends", "/leaderboard": "Leaderboard" };

export function TabLoading() {
  const title = labels[usePathname()] ?? "Page";
  return (
    <div className="min-h-screen px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mx-auto flex max-w-[880px] flex-col gap-5">
        <header className="glass-card rounded-[1.9rem] p-4"><BrandMark showTagline={false} /></header>
        <main id="main-content" aria-busy="true" className="surface-primary rounded-[1.75rem] p-4 sm:p-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p role="status" className="mt-3 text-sm text-muted-foreground">Loading {title.toLowerCase()}…</p>
          <div aria-hidden="true" className="mt-6 grid gap-3">
            <div className="h-24 rounded-2xl bg-white/[0.05]" />
            <div className="h-24 rounded-2xl bg-white/[0.05]" />
          </div>
        </main>
      </div>
    </div>
  );
}
