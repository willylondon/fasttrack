"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type InstallPromptProps = {
  currentPath:
    | "/"
    | "/history"
    | "/feed"
    | "/friends"
    | "/leaderboard"
    | "/profile"
    | "/challenges"
    | `/challenges/${string}`;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fasttrack-install-dismissed-v2";
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

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

  const isAndroidMobile = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /android/i.test(navigator.userAgent);
  }, []);

  const isAppleMobile = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    const savedDismissal = window.localStorage.getItem(DISMISS_KEY);
    const dismissedAt = savedDismissal ? Number(savedDismissal) : 0;
    const dismissalStillActive = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DURATION_MS;
    setDismissed(dismissalStillActive || isStandalone());

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
      window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }

    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  if (dismissed || currentPath.startsWith("/challenges/")) {
    return null;
  }

  if (!supportsPrompt && !isAppleMobile && !isAndroidMobile) {
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
                : isAndroidMobile
                  ? "Install FastTrack: open Chrome's menu, then tap Install app or Add to Home screen."
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
