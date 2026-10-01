"use client";

import { usePathname } from "next/navigation";
import { TabLink } from "@/components/layout/tab-link";
import { CalendarDays, Home, Trophy, UserRound, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { NavigationPending } from "@/components/layout/navigation-pending";

const navItems = [
  { href: "/", label: "Today", icon: Home },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function getPrimaryPath(currentPath: string) {
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

export function MobileNav() {
  const primaryPath = getPrimaryPath(usePathname());

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[rgba(11,11,11,0.95)] shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[900px] grid-cols-5 gap-1 px-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {navItems.map((item) => {
          const active = item.href === primaryPath;
          const Icon = item.icon;

          return (
            <TabLink
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition-colors",
                active ? "text-primary-readable" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-2xl transition-all",
                  active
                    ? "bg-primary/15 text-primary-readable shadow-[inset_0_0_0_1px_rgba(139,92,246,0.22)]"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="max-w-full text-[11px] font-medium tracking-normal">{item.label}</span>
              <NavigationPending />
            </TabLink>
          );
        })}
      </div>
    </nav>
  );
}
