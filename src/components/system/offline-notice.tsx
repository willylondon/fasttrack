"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="glass-soft flex items-center gap-3 rounded-[1.4rem] border border-amber-500/20 px-4 py-3 text-sm text-amber-100"
    >
      <div className="rounded-full bg-amber-500/15 p-2 text-amber-300">
        <WifiOff className="size-4" />
      </div>
      <p>You’re offline. FastTrack will reconnect when your connection returns.</p>
    </div>
  );
}
