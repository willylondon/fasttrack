import {
  type DashboardData,
  type FastSession,
  MAX_PUBLIC_FAST_MINUTES,
  MIN_PUBLIC_FAST_MINUTES,
  EMPTY_DASHBOARD_DATA,
  EMPTY_HISTORY_DATA,
  type HistoryData,
} from "./fasting";

export const LOCAL_DASHBOARD_STORAGE_KEY = "fasttrack.local-dashboard.v1";

export const SYNC_AFTER_SIGN_IN_KEY = `${LOCAL_DASHBOARD_STORAGE_KEY}:sync-after-sign-in`;

export function safeStorageRead(kind: "localStorage" | "sessionStorage", key: string): string | null {
  try { return typeof window === "undefined" ? null : window[kind].getItem(key); } catch { return null; }
}

export function safeStorageWrite(kind: "localStorage" | "sessionStorage", key: string, value: string | null): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (value === null) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
    return true;
  } catch { return false; }
}

function normalizeSession(raw: unknown): FastSession | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<FastSession>;
  const validDate = (date: unknown): date is string => typeof date === "string" && Number.isFinite(Date.parse(date));
  if (typeof value.id !== "string" || !value.id.trim() || value.id.length > 128 ||
      !validDate(value.startedAt) || !validDate(value.createdAt) ||
      !Number.isInteger(value.plannedMinutes) || value.plannedMinutes! < MIN_PUBLIC_FAST_MINUTES || value.plannedMinutes! > MAX_PUBLIC_FAST_MINUTES ||
      !["active", "completed", "cancelled"].includes(value.status ?? "")) return null;
  if (value.status !== "active" && (!validDate(value.endedAt) || Date.parse(value.endedAt) < Date.parse(value.startedAt))) return null;
  const durationMinutes = value.status === "active" ? null : Math.round((Date.parse(value.endedAt!) - Date.parse(value.startedAt)) / 60000);
  return {
    id: value.id, userId: "local", startedAt: value.startedAt, createdAt: value.createdAt,
    endedAt: value.status === "active" ? null : value.endedAt!, durationMinutes,
    plannedMinutes: value.plannedMinutes!, status: value.status!,
    notes: typeof value.notes === "string" ? value.notes.slice(0, 600) : null,
    stageReached: Number.isInteger(value.stageReached) ? Math.min(24, Math.max(0, value.stageReached!)) : 0,
  };
}

export function normalizeLocalDashboardData(raw: unknown): DashboardData {
  const parsed =
    raw && typeof raw === "object" ? (raw as Partial<DashboardData>) : ({} as Partial<DashboardData>);

  const active = normalizeSession(parsed.activeSession);
  const seen = new Set<string>();
  const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : []).flatMap((raw) => {
    const session = normalizeSession(raw);
    if (!session || session.status === "active" || seen.has(session.id)) return [];
    seen.add(session.id);
    return [session];
  });
  return {
    ...EMPTY_DASHBOARD_DATA,
    activeSession: active?.status === "active" ? active : null,
    sessions,
    milestoneStageReached: Number.isInteger(parsed.milestoneStageReached) ? Math.min(24, Math.max(0, parsed.milestoneStageReached!)) : 0,
  };
}

export function readLocalDashboardData(): DashboardData {
  if (typeof window === "undefined") {
    return EMPTY_DASHBOARD_DATA;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_DASHBOARD_STORAGE_KEY);

    if (!raw) {
      return EMPTY_DASHBOARD_DATA;
    }

    return normalizeLocalDashboardData(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_DASHBOARD_DATA;
  }
}

export function writeLocalDashboardData(data: DashboardData): boolean {
  return safeStorageWrite("localStorage", LOCAL_DASHBOARD_STORAGE_KEY, JSON.stringify({
    activeSession: data.activeSession,
    sessions: data.sessions,
    milestoneStageReached: data.milestoneStageReached,
  }));
}

export function buildSignedOutHistoryData(source: DashboardData): HistoryData {
  const normalized = normalizeLocalDashboardData(source);

  return {
    ...EMPTY_HISTORY_DATA,
    sessions: normalized.sessions.filter(
      (session) => session.status === "completed" && (session.durationMinutes ?? 0) > 0
    ),
  };
}

type PostSyncOptions = {
  activeSessionSynced?: boolean;
  completedSessionIds?: string[];
};

export function buildPostSyncLocalDashboardData(
  source: DashboardData,
  options: PostSyncOptions = { activeSessionSynced: true }
): DashboardData | null {
  const normalized = normalizeLocalDashboardData(source);
  const completedSessionIds = new Set(options.completedSessionIds ?? []);
  const remainingSessions = normalized.sessions.filter(
    (session) => !completedSessionIds.has(session.id)
  );
  const activeSession = options.activeSessionSynced ? null : normalized.activeSession;

  if (!activeSession && !remainingSessions.length) {
    return null;
  }

  return {
    ...normalized,
    activeSession,
    sessions: remainingSessions,
    milestoneStageReached: activeSession ? normalized.milestoneStageReached : 0,
  };
}
