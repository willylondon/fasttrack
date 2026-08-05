import {
  type DashboardData,
  EMPTY_DASHBOARD_DATA,
  EMPTY_HISTORY_DATA,
  type HistoryData,
} from "./fasting";

export const LOCAL_DASHBOARD_STORAGE_KEY = "fasttrack.local-dashboard.v1";

export function normalizeLocalDashboardData(raw: unknown): DashboardData {
  const parsed =
    raw && typeof raw === "object" ? (raw as Partial<DashboardData>) : ({} as Partial<DashboardData>);

  return {
    ...EMPTY_DASHBOARD_DATA,
    activeSession: parsed.activeSession ?? null,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    milestoneStageReached: typeof parsed.milestoneStageReached === "number" ? parsed.milestoneStageReached : 0,
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

export function writeLocalDashboardData(data: DashboardData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOCAL_DASHBOARD_STORAGE_KEY,
    JSON.stringify({
      activeSession: data.activeSession,
      sessions: data.sessions,
      milestoneStageReached: data.milestoneStageReached,
    })
  );
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
