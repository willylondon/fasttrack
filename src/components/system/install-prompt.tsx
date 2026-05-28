"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type InstallPromptProps = {
  currentPath: "/" | "/history" | "/feed" | "/friends" | "/leaderboard" | "/profile";
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fasttrack-install-dismissed-v1";

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallPrompt({ currentPath }: InstallPromptProps) {
  const [dismissed, setDismissed] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [supportsPrompt, setSupportsPrompt] = useState(false);

  const isAppleMobile = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    const savedDismissal = window.localStorage.getItem(DISMISS_KEY);
    setDismissed(savedDismissal === "1" || isStandalone());

    const handlePromptReady = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setSupportsPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handlePromptReady);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePromptReady);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setDismissed(true);
      window.localStorage.setItem(DISMISS_KEY, "1");
    }

    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  if (dismissed || currentPath !== "/") {
    return null;
  }

  if (!supportsPrompt && !isAppleMobile) {
    return null;
  }

  return (
    <div className="glass-card section-enter relative overflow-hidden rounded-[1.7rem] p-4" style={{ animationDelay: "0ms" }}>
      <button
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
        onClick={handleDismiss}
        type="button"
      >
        <X className="size-4" />
      </button>
      <div className="flex flex-col gap-4 pr-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/12 p-2.5 text-primary shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            {supportsPrompt ? <Download className="size-4" /> : <Smartphone className="size-4" />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Install FastTrack</p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {supportsPrompt
                ? "Install FastTrack on this device for a cleaner, app-like experience."
                : "Install FastTrack: tap Share, then Add to Home Screen."}
            </p>
          </div>
        </div>
        {supportsPrompt ? (
          <Button className="w-full sm:w-auto" onClick={() => void handleInstall()}>
            Install FastTrack
          </Button>
        ) : null}
      </div>
    </div>
  );
}
