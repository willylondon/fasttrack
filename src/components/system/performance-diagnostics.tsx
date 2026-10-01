"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createTabTimingTracker, EMPTY_TAB_TIMING, TAB_CONTENT_READY, TAB_NAVIGATION_START, tabIndex } from "@/lib/tab-navigation-timing";
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
  const [tabTiming, setTabTiming] = useState(EMPTY_TAB_TIMING);
  const trackerRef = useRef(createTabTimingTracker());
  const pathname = usePathname();
  const pathRef = useRef(pathname);
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

  useEffect(() => {
    pathRef.current = pathname;
    if (!open) return;
    setTabTiming(trackerRef.current.commit(tabIndex(pathname), performance.now()));
  }, [pathname, open]);

  useEffect(() => {
    if (!open) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const interrupt = () => {
      if (!observingRef.current) return;
      clearTimeout(timeout);
      setTabTiming(trackerRef.current.interrupt());
    };
    const start = (event: Event) => {
      if (!observingRef.current) return;
      const tab = (event as CustomEvent<unknown>).detail;
      if (typeof tab !== "number") return;
      clearTimeout(timeout);
      setTabTiming(trackerRef.current.start(tab, tabIndex(pathRef.current), performance.now()));
      timeout = setTimeout(interrupt, 30_000);
    };
    const ready = (event: Event) => {
      if (!observingRef.current) return;
      const tab = (event as CustomEvent<unknown>).detail;
      if (typeof tab !== "number") return;
      const result = trackerRef.current.ready(tab, performance.now());
      if (result.state === "ready") clearTimeout(timeout);
      setTabTiming(result);
    };
    const visibility = () => { if (document.visibilityState === "hidden") interrupt(); };
    window.addEventListener(TAB_NAVIGATION_START, start);
    window.addEventListener(TAB_CONTENT_READY, ready);
    window.addEventListener("popstate", interrupt);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timeout);
      trackerRef.current = createTabTimingTracker();
      window.removeEventListener(TAB_NAVIGATION_START, start);
      window.removeEventListener(TAB_CONTENT_READY, ready);
      window.removeEventListener("popstate", interrupt);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [open]);

  function close() {
    observingRef.current = false;
    setOpen(false);
    setTimings(EMPTY_LOCAL_TIMINGS);
    setTabTiming(EMPTY_TAB_TIMING);
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
        <dt>Last tab: route committed</dt><dd>{milliseconds(tabTiming.commitMs)}</dd>
        <dt>Last tab: primary content</dt><dd>{milliseconds(tabTiming.readyMs)}</dd>
        <dt>Tab measurement</dt><dd>{tabTiming.state === "idle" ? "Tap a tab to measure" : tabTiming.state === "opening" ? "Opening…" : tabTiming.state === "interrupted" ? "Interrupted / timed out" : "Complete"}</dd>
        <dt>Latest app request</dt><dd>{milliseconds(timings.appRequestMs)}</dd>
        <dt>Reported server auth</dt><dd>{milliseconds(timings.authMs)}</dd>
        <dt>Reported server data</dt><dd>{milliseconds(timings.dataMs)}</dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Initial page timings describe the document load, not later tab switches. Last tab measures a tab tap to route commit and primary content after a rendering frame; it excludes optional panels and charts. These are not INP scores. Latest app request can be an unrelated prefetch; some requests don’t report server timing.</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Use the app normally, then return to this panel at the bottom of the page to share these numbers if helpful. Only timings are shown. Nothing is saved or sent by this check; closing it clears the readings.</p>
    </aside>
  );
}
