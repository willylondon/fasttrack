import Link from "next/link";
import { Menu } from "lucide-react";
import { Session } from "next-auth";

import { AuthButton } from "@/components/auth/auth-button";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
        <header className="rounded-[1.75rem] border border-border/80 bg-card/80 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur">
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
                    buttonVariants({
                      variant: item.href === currentPath ? "default" : "ghost",
                      size: "sm",
                    }),
                    "rounded-full"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Separator orientation="vertical" className="mx-1 h-6" />
              <AuthButton providers={providers} user={session?.user} />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <AuthButton providers={providers} user={session?.user} />
              <Sheet>
                <SheetTrigger
                  aria-label="Open navigation"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "icon-sm" }),
                    "rounded-full"
                  )}
                >
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="right" className="border-l border-border/80 bg-card">
                  <SheetHeader>
                    <SheetTitle>FastTrack</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                  </SheetHeader>
                  <nav className="space-y-2 px-4 pb-6">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          buttonVariants({
                            variant: item.href === currentPath ? "default" : "ghost",
                            size: "default",
                          }),
                          "w-full justify-start rounded-2xl"
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">FastTrack App</p>
              <h1 className="mt-2 font-[family:var(--font-heading)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </header>
        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
