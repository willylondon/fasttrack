"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_LOCAL_TIMINGS, readAppRequestTimings, readDocumentTimings } from "@/lib/performance-diagnostics";

const OPEN_EVENT = "fasttrack:open-performance-check";

export function PerformanceCheckButton() {
  return (
    <button
      type="button"
      aria-controls="fasttrack-performance-panel"
      className="inline-flex min-h-11 items-center rounded-md px-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      Timing check
    </button>
  );
}

export function PerformanceDiagnostics() {
  const [open, setOpen] = useState(false);
  const [timings, setTimings] = useState(EMPTY_LOCAL_TIMINGS);
  const returnFocus = useRef<HTMLElement | null>(null);
  const observingRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const show = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      observingRef.current = true;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    // Explicit opt-in for a shared browser link; the footer button also works in
    // an already-installed home-screen app without changing its URL or state.
    if (new URLSearchParams(window.location.search).get("diagnostics") === "1") show();
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    observingRef.current = true;
    closeRef.current?.focus();
    const documentTimings = () => readDocumentTimings(
      performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined,
      performance.getEntriesByName("first-contentful-paint")[0],
    );
    setTimings({ ...EMPTY_LOCAL_TIMINGS, ...documentTimings() });
    if (!("PerformanceObserver" in window)) return;
    const observer = new PerformanceObserver((list) => {
      if (!observingRef.current) return;
      for (const entry of list.getEntries()) {
        if (entry.entryType === "resource") {
          const app = readAppRequestTimings(entry as PerformanceResourceTiming, window.location.origin);
          if (app) setTimings((current) => ({ ...current, ...app }));
        } else {
          setTimings((current) => ({ ...current, ...documentTimings() }));
        }
      }
    });
    const entryTypes = Array.isArray(PerformanceObserver.supportedEntryTypes)
      ? ["navigation", "paint", "resource"].filter((type) => PerformanceObserver.supportedEntryTypes.includes(type))
      : ["resource"];
    try { if (entryTypes.length) observer.observe({ entryTypes }); }
    catch { observer.disconnect(); }
    return () => { observingRef.current = false; observer.disconnect(); };
  }, [open]);

  function close() {
    observingRef.current = false;
    setOpen(false);
    setTimings(EMPTY_LOCAL_TIMINGS);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    returnFocus.current = null;
  }

  if (!open) return null;
  const milliseconds = (value: number | null) => value === null ? "Not available" : `${value.toLocaleString()} ms`;
  return (
    <aside id="fasttrack-performance-panel" aria-label="Local performance timing" className="mx-auto mb-[calc(env(safe-area-inset-bottom)+8rem)] w-[min(30rem,calc(100vw-1.5rem))] rounded-2xl border border-white/20 bg-[#141416] p-4 text-sm text-foreground shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Local timing check</h2>
        <button ref={closeRef} type="button" aria-label="Close performance check" onClick={close} className="min-h-11 rounded-lg px-3 text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs">
        <dt>Initial page: first byte</dt><dd>{milliseconds(timings.firstByteMs)}</dd>
        <dt>Initial page: downloaded</dt><dd>{milliseconds(timings.documentMs)}</dd>
        <dt>Initial page: content paint</dt><dd>{milliseconds(timings.firstPaintMs)}</dd>
        <dt>Latest app request</dt><dd>{milliseconds(timings.appRequestMs)}</dd>
        <dt>Reported server auth</dt><dd>{milliseconds(timings.authMs)}</dd>
        <dt>Reported server data</dt><dd>{milliseconds(timings.dataMs)}</dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">First byte includes connection and server time. Paint is a rendering milestone, not a responsiveness score. App requests can include background prefetches; some don’t report server timing.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Use the app normally, then return to this panel at the bottom of the page to share these numbers if helpful. Only timings are shown. Nothing is saved or sent by this check; closing it clears the readings.</p>
    </aside>
  );
}
