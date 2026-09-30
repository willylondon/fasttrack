import type { DashboardData, FastSession } from "./fasting";

/** Reject calendar rollover (for example February 30), including nonexistent local DST times. */
export function resolveLocalDateTime(dateValue: string, timeValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeValue)) return null;
  const parsed = new Date(`${dateValue}T${timeValue}:00`);
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  if (!Number.isFinite(parsed.getTime()) || parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day || parsed.getHours() !== hour || parsed.getMinutes() !== minute) return null;
  return parsed.toISOString();
}

/** A committed mutation must remain visible even when the subsequent dashboard fetch fails. */
export function reconcileFastSession(data: DashboardData, session: FastSession): DashboardData {
  return {
    ...data,
    activeSession: session.status === "active" ? session : data.activeSession?.id === session.id ? null : data.activeSession,
    sessions: session.status === "active" ? data.sessions : [session, ...data.sessions.filter((item) => item.id !== session.id)],
    milestoneStageReached: session.status === "active" ? session.stageReached : data.activeSession?.id === session.id ? 0 : data.milestoneStageReached,
  };
}

/** Legacy reward queues contain identifiers only; retained for compatibility. */
export function parsePendingRewardIds(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string =>
      typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))] : [];
  } catch { return []; }
}

export type PendingCompletion = {
  sessionId: string;
  accountId: string;
  /** Absent only for legacy entries created after a confirmed completion. */
  endedAt?: string;
};

export function parsePendingCompletions(raw: string | null, accountId: string): PendingCompletion[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const entries = new Map<string, PendingCompletion>();
    for (const item of value) {
      const entry = typeof item === "string" ? { sessionId: item, accountId } : item;
      if (!entry || typeof entry !== "object" || entry.accountId !== accountId ||
          typeof entry.sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.sessionId)) continue;
      if (entry.endedAt !== undefined && (typeof entry.endedAt !== "string" || !Number.isFinite(Date.parse(entry.endedAt)))) continue;
      const parsed: PendingCompletion = { sessionId: entry.sessionId, accountId, ...(entry.endedAt ? { endedAt: entry.endedAt } : {}) };
      // Never replace the first chosen time with a subsequent retry or a legacy entry.
      if (!entries.has(parsed.sessionId) || (!entries.get(parsed.sessionId)?.endedAt && parsed.endedAt)) entries.set(parsed.sessionId, parsed);
    }
    return [...entries.values()];
  } catch { return []; }
}

export function completionRetryBody(intent: PendingCompletion) {
  return { action: "complete" as const, expectedAccountId: intent.accountId, ...(intent.endedAt ? { endedAt: intent.endedAt } : {}) };
}

/** Most 400 responses are ambiguous database errors in this API, so retain them. */
export function isDefinitiveCompletionRejection(status: number, message: string): boolean {
  return (status === 404 && message === "Fast session not found.") ||
    (status === 409 && message === "This fast already ended with a different action.");
}
