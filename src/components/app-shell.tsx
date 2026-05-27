import Link from "next/link";
import { Session } from "next-auth";

import { AuthButton } from "@/components/auth/auth-button";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  currentPath: "/" | "/history" | "/feed" | "/friends" | "/leaderboard" | "/profile";
  description: string;
  providers: {
    google: boolean;
    github: boolean;
  };
  session: Session | null;
  title: string;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/feed", label: "Feed" },
  { href: "/friends", label: "Friends" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
] as const;

export function AppShell({
  children,
  currentPath,
  description,
  providers,
  session,
  title,
}: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_22%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6">
        <header className="glass-card rounded-[1.9rem] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="min-w-0">
              <BrandMark />
            </Link>
            <div className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group/nav relative inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-all duration-200",
                    item.href === currentPath
                      ? "bg-white/[0.1] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute -bottom-1.5 h-1.5 w-1.5 rounded-full bg-primary transition-all",
                      item.href === currentPath ? "opacity-100" : "opacity-0 group-hover/nav:opacity-60"
                    )}
                  />
                </Link>
              ))}
              <Separator orientation="vertical" className="mx-1 h-6" />
              <AuthButton providers={providers} user={session?.user} />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <AuthButton providers={providers} user={session?.user} />
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">FastTrack App</p>
              <h1 className="mt-2 font-[family:var(--font-heading)] text-4xl font-semibold tracking-tight sm:text-[2.75rem]">
                {title}
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </header>
        <main className="flex-1 py-6 pb-24 md:pb-6">{children}</main>
      </div>
      <MobileNav currentPath={currentPath} />
    </div>
  );
}
