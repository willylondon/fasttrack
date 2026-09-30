export type LocalTimingSnapshot = {
  firstByteMs: number | null;
  documentMs: number | null;
  firstPaintMs: number | null;
  appRequestMs: number | null;
  authMs: number | null;
  dataMs: number | null;
};

export const EMPTY_LOCAL_TIMINGS: LocalTimingSnapshot = {
  firstByteMs: null, documentMs: null, firstPaintMs: null,
  appRequestMs: null, authMs: null, dataMs: null,
};

function duration(value: number) {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

export function readDocumentTimings(
  navigation?: Pick<PerformanceNavigationTiming, "startTime" | "responseStart" | "responseEnd">,
  firstPaint?: Pick<PerformanceEntry, "startTime">,
): Pick<LocalTimingSnapshot, "firstByteMs" | "documentMs" | "firstPaintMs"> {
  return {
    firstByteMs: navigation && navigation.responseStart > 0 ? duration(navigation.responseStart - navigation.startTime) : null,
    documentMs: navigation && navigation.responseEnd > 0 ? duration(navigation.responseEnd - navigation.startTime) : null,
    firstPaintMs: firstPaint ? duration(firstPaint.startTime) : null,
  };
}

/** Accept same-origin app fetches only. Return numbers, never URLs or identifiers. */
export function readAppRequestTimings(
  entry: Pick<PerformanceResourceTiming, "name" | "initiatorType" | "duration"> & {
    serverTiming?: readonly Pick<PerformanceServerTiming, "name" | "duration" | "description">[];
  },
  origin: string,
): Pick<LocalTimingSnapshot, "appRequestMs" | "authMs" | "dataMs"> | null {
  let url: URL;
  try { url = new URL(entry.name); } catch { return null; }
  if (url.origin !== origin || entry.initiatorType !== "fetch" ||
      !(url.pathname.startsWith("/api/") || url.searchParams.has("_rsc"))) return null;
  const server = entry.serverTiming ?? [];
  const auth = server.find((metric) => metric.name === "auth");
  const data = server.find((metric) => metric.name === "data");
  return {
    appRequestMs: duration(entry.duration),
    authMs: auth ? duration(auth.duration) : null,
    dataMs: data ? duration(data.duration) : null,
  };
}
