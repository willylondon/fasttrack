"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, Home, Trophy, Users } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileNavProps = {
  currentPath: "/" | "/history" | "/feed" | "/friends" | "/leaderboard" | "/profile" | "/challenges" | `/challenges/${string}`;
};

const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: BarChart3 },
] as const;

function getPrimaryPath(currentPath: MobileNavProps["currentPath"]) {
  if (currentPath === "/feed") {
    return "/friends";
  }

  if (currentPath === "/leaderboard") {
    return "/profile";
  }

  if (currentPath.startsWith("/challenges")) {
    return "/challenges";
  }

  return currentPath;
}

export function MobileNav({ currentPath }: MobileNavProps) {
  const primaryPath = getPrimaryPath(currentPath);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[rgba(11,11,11,0.95)] shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[900px] grid-cols-5 gap-1 px-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {navItems.map((item) => {
          const active = item.href === primaryPath;
          const Icon = item.icon;

          return (
            <Link
              aria-label={item.label}
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-2xl transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.22)]"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="max-w-full text-[8px] font-medium uppercase tracking-normal">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
