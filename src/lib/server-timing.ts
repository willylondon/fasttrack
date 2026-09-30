// Durations only: never put account identifiers, queries, or health data in headers.
export function serverTimingHeaders(authMs: number, dataMs: number) {
  const duration = (value: number) => Number.isFinite(value) ? Math.max(0, value).toFixed(1) : "0.0";
  return { "Server-Timing": `auth;dur=${duration(authMs)}, data;dur=${duration(dataMs)}` };
}
