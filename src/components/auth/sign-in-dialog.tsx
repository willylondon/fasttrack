"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { CircleUserRound, Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeStorageWrite, SYNC_AFTER_SIGN_IN_KEY } from "@/lib/local-dashboard";
import { cn } from "@/lib/utils";
import { resolveSafeSignInCallback } from "@/lib/auth-recovery";

type SignInDialogProps = {
  buttonClassName?: string;
  buttonLabel?: string;
  providers: {
    google: boolean;
    github: boolean;
  };
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
};

export function SignInDialog({
  buttonClassName,
  buttonLabel = "Sign in",
  providers,
  size = "sm",
  variant = "default",
}: SignInDialogProps) {
  const [open, setOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAnyProvider = providers.google || providers.github;

  const resolveCallbackUrl = () => {
    if (typeof window === "undefined") {
      return "/";
    }

    return resolveSafeSignInCallback(window.location.href);
  };

  const handleSignIn = (provider: "google" | "github") => {
    setPendingProvider(provider);
    if (!safeStorageWrite("sessionStorage", SYNC_AFTER_SIGN_IN_KEY, "true")) {
      toast.warning("Device storage is unavailable. Your local progress cannot sync automatically after sign-in.");
    }
    startTransition(async () => {
      try {
        await signIn(provider, { callbackUrl: resolveCallbackUrl() });
      } catch {
        toast.error("Sign-in couldn’t start. Please try again.");
      } finally {
        setPendingProvider(null);
      }
    });
  };

  return (
    <>
      <Button className={cn("min-h-11", buttonClassName)} onClick={() => setOpen(true)} size={size} variant={variant}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-border/80 bg-card p-0 sm:max-w-md [&_[data-slot=dialog-close]]:min-h-11 [&_[data-slot=dialog-close]]:min-w-11">
          <DialogHeader className="p-6 pb-3">
            <Badge variant="outline" className="mb-3 w-fit border-primary/30 text-primary-readable">
              FastTrack account
            </Badge>
            <DialogTitle>Sign in to FastTrack</DialogTitle>
            <DialogDescription>
              Save your window, keep your streak, and stay accountable across your devices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2">
            <Button
              className="h-11 w-full justify-center bg-white text-black hover:bg-white/90"
              disabled={!providers.google || isPending}
              onClick={() => handleSignIn("google")}
            >
              <Globe2 className="mr-2 size-4" />
              {pendingProvider === "google" ? "Connecting Google..." : "Continue with Google"}
            </Button>
            <Button
              className="h-11 w-full justify-center bg-[#1f2937] text-white hover:bg-[#111827]"
              disabled={!providers.github || isPending}
              onClick={() => handleSignIn("github")}
            >
              <CircleUserRound className="mr-2 size-4" />
              {pendingProvider === "github" ? "Connecting GitHub..." : "Continue with GitHub"}
            </Button>
            {!hasAnyProvider ? (
              <p className="text-sm text-muted-foreground">
                Sign-in is unavailable in this environment. You can still track fasts on this device.
              </p>
            ) : null}
            <Button variant="ghost" className="min-h-11 w-full" onClick={() => setOpen(false)}>Continue without signing in</Button>
          </div>
          <DialogFooter className="mx-0 mb-0 sm:mx-0 sm:mb-0 border-t border-border/70 bg-muted/30 px-6 py-4">
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground">
                Choose the account you want to use for streaks, history, friends, and saved progress.
              </p>
              <p className="text-xs text-muted-foreground">
                By continuing, you agree to the{" "}
                <Link className="underline underline-offset-4 hover:text-foreground" href="/terms">
                  Terms
                </Link>{" "}
                and{" "}
                <Link className="underline underline-offset-4 hover:text-foreground" href="/privacy">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
