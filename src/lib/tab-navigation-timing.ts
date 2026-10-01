/** In-memory, opt-in timing only. Never stores URLs, account IDs, or history. */
export const TAB_PATHS = ["/", "/history", "/challenges", "/friends", "/profile"] as const;
export const TAB_NAVIGATION_START = "fasttrack:tab-navigation-start";
export const TAB_CONTENT_READY = "fasttrack:tab-content-ready";
export type TabTiming = { commitMs: number | null; readyMs: number | null; state: "idle" | "opening" | "ready" | "interrupted" };
export const EMPTY_TAB_TIMING: TabTiming = { commitMs: null, readyMs: null, state: "idle" };
export function tabIndex(path: string): number { return TAB_PATHS.indexOf(path as typeof TAB_PATHS[number]); }

export function createTabTimingTracker() {
  let pending: { tab: number; startedAt: number; commitMs: number | null } | null = null;
  let result: TabTiming = { ...EMPTY_TAB_TIMING };
  const elapsed = (now: number) => pending && Number.isFinite(now) && now >= pending.startedAt ? Math.round(now - pending.startedAt) : null;
  return {
    start(tab: number, currentTab: number, now: number): TabTiming {
      if (!Number.isInteger(tab) || tab < 0 || tab >= TAB_PATHS.length || !Number.isFinite(now) || now < 0) return { ...result };
      if (tab === currentTab) {
        if (pending) { pending = null; result = { ...EMPTY_TAB_TIMING, state: "interrupted" }; }
        return { ...result };
      }
      pending = { tab, startedAt: now, commitMs: null };
      result = { ...EMPTY_TAB_TIMING, state: "opening" };
      return { ...result };
    },
    commit(tab: number, now: number): TabTiming {
      if (pending?.tab === tab && pending.commitMs === null) {
        pending.commitMs = elapsed(now);
        result = { ...result, commitMs: pending.commitMs };
      }
      return { ...result };
    },
    ready(tab: number, now: number): TabTiming {
      if (pending?.tab === tab) {
        const readyMs = elapsed(now);
        result = readyMs === null ? { ...EMPTY_TAB_TIMING, state: "interrupted" }
          : { commitMs: pending.commitMs, readyMs, state: "ready" };
        pending = null;
      }
      return { ...result };
    },
    interrupt(): TabTiming {
      if (pending) result = { ...EMPTY_TAB_TIMING, state: "interrupted" };
      pending = null;
      return { ...result };
    },
  };
}
