"use client";

import { signOut } from "next-auth/react";
import { LogOut, Sparkles } from "lucide-react";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuthButtonProps = {
  providers: {
    google: boolean;
    github: boolean;
  };
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

export function AuthButton({ providers, user }: AuthButtonProps) {
  if (!user) {
    return <SignInDialog providers={providers} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open account menu"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="default">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? "FastTrack user"} />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border border-border/70 bg-card">
        <DropdownMenuLabel className="space-y-1 px-3 py-2">
          <p className="font-medium text-foreground">{user.name ?? "FastTrack user"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email ?? "No email available"}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 px-3 py-2 text-muted-foreground">
          <Sparkles className="size-4" />
          Your progress, badges, and account settings live here.
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 px-3 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
