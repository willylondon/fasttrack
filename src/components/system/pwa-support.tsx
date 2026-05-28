"use client";

import { useEffect } from "react";

export function PwaSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures in production UI.
    });
  }, []);

  return null;
}
