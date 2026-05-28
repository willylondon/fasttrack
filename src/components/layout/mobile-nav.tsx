"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

type MobileNavProps = {
  currentPath: "/" | "/history" | "/feed" | "/friends" | "/leaderboard" | "/profile";
};

const navItems = [
  { href: "/", label: "Today", icon: "🏠" },
  { href: "/history", label: "History", icon: "📋" },
  { href: "/friends", label: "Friends", icon: "👥" },
  { href: "/profile", label: "Profile", icon: "👤" },
] as const;

function getPrimaryPath(currentPath: MobileNavProps["currentPath"]) {
  if (currentPath === "/feed") {
    return "/friends";
  }

  if (currentPath === "/leaderboard") {
    return "/profile";
  }

  return currentPath;
}

export function MobileNav({ currentPath }: MobileNavProps) {
  const primaryPath = getPrimaryPath(currentPath);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[rgba(11,11,11,0.95)] shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[900px] grid-cols-4 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {navItems.map((item) => {
          const active = item.href === primaryPath;

          return (
            <Link
              aria-label={item.label}
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition-colors",
                active ? "text-[#8B5CF6]" : "text-gray-500"
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
