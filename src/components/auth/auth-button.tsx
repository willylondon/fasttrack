"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Sparkles } from "lucide-react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AuthButtonProps = {
  providers: {
    google: boolean;
    github: boolean;
  };
  profile?: {
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

function getInitials(value?: string | null) {
  if (!value) {
    return "FT";
  }

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AuthButton({ profile, providers, user }: AuthButtonProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = profile?.displayName ?? user?.name ?? "FastTrack user";
  const avatarUrl = profile?.avatarUrl ?? user?.image ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) {
    return <SignInDialog providers={providers} />;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        aria-label="Open account menu"
        aria-expanded={open}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Avatar size="default">
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-[70] w-64 overflow-hidden rounded-2xl",
            "border border-border/70 bg-card p-1 text-sm text-card-foreground shadow-[0_24px_60px_rgba(0,0,0,0.36)]"
          )}
          role="menu"
        >
          <div className="space-y-1 px-3 py-2">
            <p className="font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email ?? "No email available"}</p>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <div className="flex gap-2 rounded-xl px-3 py-2 text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <span>Your progress, badges, and account settings live here.</span>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <button
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-destructive transition hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
            onClick={() => signOut({ callbackUrl: "/" })}
            role="menuitem"
            type="button"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
