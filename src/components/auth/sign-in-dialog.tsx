"use client";

import { useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";

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

  const handleSignIn = (provider: "google" | "github") => {
    setPendingProvider(provider);
    startTransition(async () => {
      await signIn(provider, { callbackUrl: "/" });
      setPendingProvider(null);
    });
  };

  return (
    <>
      <Button className={cn(buttonClassName)} onClick={() => setOpen(true)} size={size} variant={variant}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-border/80 bg-card p-0 sm:max-w-md">
          <DialogHeader className="p-6 pb-3">
            <Badge variant="outline" className="mb-3 w-fit border-primary/30 text-primary">
              FastTrack account
            </Badge>
            <DialogTitle>Join FastTrack</DialogTitle>
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
                Sign-in is being configured for this environment. Please try again shortly.
              </p>
            ) : null}
          </div>
          <DialogFooter className="border-t border-border/70 bg-muted/30 px-6 py-4">
            <p className="w-full text-xs text-muted-foreground">
              Choose the account you want to use for streaks, history, friends, and saved progress.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
